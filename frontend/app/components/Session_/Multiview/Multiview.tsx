import React from 'react';
import { useStore } from 'App/mstore';
import { BackLink, Icon } from 'UI';
import { observer } from 'mobx-react-lite';
import { connect } from 'react-redux';
import { fetchSessions, customSetSessions } from 'Duck/liveSearch';
import { useHistory, useParams } from 'react-router-dom';
import { liveSession, assist, withSiteId, multiview } from 'App/routes';
import AssistSessionsModal from 'App/components/Session_/Player/Controls/AssistSessionsModal';
import { useModal } from 'App/components/Modal';
import LivePlayer from 'App/components/Session/LivePlayer';
import { InactiveTab } from 'App/components/Session_/Player/Controls/AssistSessionsTabs';

function Multiview({
  total,
  fetchSessions,
  siteId,
  assistCredendials,
  customSetSessions,
}: {
  total: number;
  customSetSessions: (data: any) => void;
  fetchSessions: (filter: any) => void;
  siteId: string;
  assistCredendials: any;
  list: Record<string, any>[];
}) {
  const { showModal, hideModal } = useModal();

  const { assistMultiviewStore } = useStore();
  const history = useHistory();
  // @ts-ignore
  const { sessionsquery } = useParams();

  const onSessionsChange = (sessions: Record<string, any>[]) => {
    const sessionIdQuery = encodeURIComponent(sessions.map((s) => s.sessionId).join(','));
    return history.replace(withSiteId(multiview(sessionIdQuery), siteId));
  };

  React.useEffect(() => {
    assistMultiviewStore.setOnChange(onSessionsChange);

    if (sessionsquery) {
      const sessionIds = decodeURIComponent(sessionsquery).split(',');
      // preset
      assistMultiviewStore.presetSessions(sessionIds).then((data) => {
        customSetSessions(data);
      });
    } else {
      fetchSessions({});
    }
  }, []);

  const openLiveSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    assistMultiviewStore.setActiveSession(sessionId);
    history.push(withSiteId(liveSession(sessionId), siteId));
  };

  const openList = () => {
    history.push(withSiteId(assist(), siteId));
  };

  const openListModal = () => {
    showModal(<AssistSessionsModal onAdd={hideModal} />, { right: true });
  };

  const replaceSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    showModal(<AssistSessionsModal onAdd={hideModal} replaceTarget={sessionId} />, { right: true });
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    assistMultiviewStore.removeSession(sessionId);
  };

  const placeholder = new Array(4 - assistMultiviewStore.sessions.length).fill(0);

  return (
    <div className="w-screen h-screen flex flex-col">
      <div className="w-full p-4 flex justify-between items-center">
        <div>
          {/* @ts-ignore */}
          <BackLink label="Back to sessions list" onClick={openList} />
        </div>
        <div>{`Watching ${assistMultiviewStore.sessions.length} of ${total} Live Sessions`}</div>
      </div>
      <div className="w-full h-full grid grid-cols-2 grid-rows-2">
        {assistMultiviewStore.sortedSessions.map((session: Record<string, any>) => (
          <div
            key={session.key}
            className="border hover:border-active-blue-border relative group cursor-pointer"
          >
            <div onClick={(e) => openLiveSession(e, session.sessionId)} className="w-full h-full">
              {session.agentToken ? (
                <LivePlayer
                  isMultiview
                  customSession={session}
                  customAssistCredendials={assistCredendials}
                />
              ) : (
                <div>Loading session</div>
              )}
            </div>
            <div className="absolute z-10 bottom-0 w-full left-0 p-2 opacity-70 bg-gray-darkest text-white flex justify-between">
              <div>{session.userDisplayName}</div>
              <div className="hidden group-hover:flex items-center gap-2">
                <div
                  className="cursor-pointer hover:font-semibold"
                  onClick={(e) => replaceSession(e, session.sessionId)}
                >
                  Replace Session
                </div>
                <div
                  className="cursor-pointer hover:font-semibold"
                  onClick={(e) => deleteSession(e, session.sessionId)}
                >
                  <Icon name="trash" size={18} color="white" />
                </div>
              </div>
            </div>
          </div>
        ))}
        {placeholder.map((_, i) => (
          <div
            key={i}
            className="border hover:border-active-blue-border flex flex-col gap-2 items-center justify-center cursor-pointer"
            onClick={openListModal}
          >
            <InactiveTab classNames="!bg-gray-bg w-12" />
            Add Session
          </div>
        ))}
      </div>
    </div>
  );
}

export default connect(
  (state: any) => ({
    total: state.getIn(['liveSearch', 'total']),
    siteId: state.getIn(['site', 'siteId']),
  }),
  {
    fetchSessions,
    customSetSessions,
  }
)(observer(Multiview));
