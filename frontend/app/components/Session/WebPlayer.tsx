import React, { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { Modal, Loader } from 'UI';
import { toggleFullscreen, closeBottomBlock } from 'Duck/components/player';
import { fetchList } from 'Duck/integrations';
import { createWebPlayer } from 'Player';
import { makeAutoObservable } from 'mobx';
import withLocationHandlers from 'HOCs/withLocationHandlers';
import { useStore } from 'App/mstore';
import PlayerBlockHeader from './Player/ReplayPlayer/PlayerBlockHeader';
import ReadNote from '../Session_/Player/Controls/components/ReadNote';
import PlayerContent from './Player/ReplayPlayer/PlayerContent';
import { IPlayerContext, PlayerContext, defaultContextValue } from './playerContext';
import { observer } from 'mobx-react-lite';
import { Note } from 'App/services/NotesService';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { fetchAutoplayList, clearAutoplayList } from '../../duck/sessions';
import Filter from 'Types/filter/filter';

const TABS = {
  EVENTS: 'User Events',
  CLICKMAP: 'Click Map',
};

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

let playerInst: IPlayerContext['player'] | undefined;

function WebPlayer(props: any) {
  const {
    session,
    toggleFullscreen,
    closeBottomBlock,
    fullscreen,
    fetchList,
    fetchAutoplayList,
    clearAutoplayList,
  } = props;
  const { notesStore } = useStore();
  const [activeTab, setActiveTab] = useState('');
  const [noteItem, setNoteItem] = useState<Note | undefined>(undefined);
  const [visuallyAdjusted, setAdjusted] = useState(false);
  // @ts-ignore
  const [contextValue, setContextValue] = useState<IPlayerContext>(defaultContextValue);
  const params: { sessionId: string } = useParams();

  useEffect(() => {
    playerInst = undefined;
    if (!session.sessionId || contextValue.player !== undefined) return;
    fetchList('issues');

    const [WebPlayerInst, PlayerStore] = createWebPlayer(
      session,
      (state) => makeAutoObservable(state),
      toast
    );
    setContextValue({ player: WebPlayerInst, store: PlayerStore });
    playerInst = WebPlayerInst;

    notesStore.fetchSessionNotes(session.sessionId).then((r) => {
      const note = props.query.get('note');
      if (note) {
        setNoteItem(notesStore.getNoteById(parseInt(note, 10), r));
        WebPlayerInst.pause();
      }
    });

    const freeze = props.query.get('freeze');
    if (freeze) {
      void WebPlayerInst.freeze();
    }
  }, [session.sessionId]);

  const { firstVisualEvent: visualOffset, messagesProcessed } = contextValue.store?.get() || {};

  React.useEffect(() => {
    if ((messagesProcessed && session.events.length > 0) || session.errors.length > 0) {
      contextValue.player?.updateLists?.(session);
    }
  }, [session.events, session.errors, contextValue.player, messagesProcessed]);

  React.useEffect(() => {
    if (noteItem !== undefined) {
      contextValue.player.pause();
    }

    if (activeTab === '' && !noteItem !== undefined && messagesProcessed && contextValue.player) {
      const jumpToTime = props.query.get('jumpto');
      const shouldAdjustOffset = visualOffset !== 0 && !visuallyAdjusted;

      if (jumpToTime || shouldAdjustOffset) {
        if (jumpToTime > visualOffset) {
          contextValue.player.jump(parseInt(jumpToTime));
        } else {
          contextValue.player.jump(visualOffset);
          setAdjusted(true);
        }
      }

      contextValue.player.play();
    }
  }, [activeTab, noteItem, visualOffset, messagesProcessed]);

  React.useEffect(() => {
    if (activeTab === 'Click Map') {
      contextValue.player?.pause();
    }
  }, [activeTab]);

  // LAYOUT (TODO: local layout state - useContext or something..)
  useEffect(
    () => () => {
      console.debug('cleaning up player after', params.sessionId);
      toggleFullscreen(false);
      closeBottomBlock();
      playerInst?.clean();
      // @ts-ignore
      setContextValue(defaultContextValue);
    },
    [params.sessionId]
  );

  useEffect(() => {
    const groupBy = props.query.get('groupBy');
    if (groupBy && groupBy in session.metadata) {
      const startDate = session.startedAt - THIRTY_DAYS_IN_MS;
      const endDate = session.startedAt + THIRTY_DAYS_IN_MS;
      clearAutoplayList();
      fetchAutoplayList({
        filters: [
          {
            value: [session.metadata[groupBy]],
            type: 'metadata',
            operator: 'is',
            source: groupBy,
            filters: [],
          },
        ],
        rangeValue: 'CUSTOM',
        startDate,
        endDate,
        groupByUser: false,
        sort: 'session_id',
        order: 'asc',
        strict: false,
        eventsOrder: 'then',
        limit: 200,
        page: 1,
      });
    }
  }, [props.location.search, session]);

  const onNoteClose = () => {
    setNoteItem(undefined);
    contextValue.player.play();
  };

  // TODO load in the other sessions for a grouped view
  if (!session.sessionId)
    return (
      <Loader
        size={75}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translateX(-50%)',
          height: 75,
        }}
      />
    );

  return (
    <PlayerContext.Provider value={contextValue}>
      <PlayerBlockHeader
        // @ts-ignore TODO?
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tabs={TABS}
        fullscreen={fullscreen}
      />
      {/* @ts-ignore  */}
      {contextValue.player ? (
        <PlayerContent
          activeTab={activeTab}
          fullscreen={fullscreen}
          setActiveTab={setActiveTab}
          session={session}
        />
      ) : (
        <Loader
          style={{ position: 'fixed', top: '0%', left: '50%', transform: 'translateX(-50%)' }}
        />
      )}
      <Modal open={noteItem !== undefined} onClose={onNoteClose}>
        {noteItem !== undefined ? (
          <ReadNote note={noteItem} onClose={onNoteClose} notFound={!noteItem} />
        ) : null}
      </Modal>
    </PlayerContext.Provider>
  );
}

export default connect(
  (state: any) => ({
    session: state.getIn(['sessions', 'current']),
    insights: state.getIn(['sessions', 'insights']),
    visitedEvents: state.getIn(['sessions', 'visitedEvents']),
    jwt: state.getIn(['user', 'jwt']),
    fullscreen: state.getIn(['components', 'player', 'fullscreen']),
    showEvents: state.get('showEvents'),
    members: state.getIn(['members', 'list']),
  }),
  {
    toggleFullscreen,
    closeBottomBlock,
    fetchList,
    fetchAutoplayList,
    clearAutoplayList,
  }
)(withLocationHandlers()(observer(WebPlayer)));
