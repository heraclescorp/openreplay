import type { Socket } from 'socket.io-client';
import type Screen from '../Screen/Screen';
import type { Store } from '../../common/types';

export type LiveViewPointerMode = 'off' | 'point';

interface State {
  currentTab?: string;
}

interface PointerSample {
  tabId?: string;
  coords: [number, number];
}

const POINTER_MODE_MESSAGE_TYPE = 'aven:live-view-pointer-mode';
const PLAYER_READY_MESSAGE_TYPE = 'aven:live-view-player-ready';
const MOVE_THROTTLE_MS = 30;

export default class LiveViewPointer {
  private mode: LiveViewPointerMode = 'off';
  private modeSyncKey: string | null = null;
  private pointedTab: { tabId?: string; syncKey: string } | null = null;
  private lastMoveSentAt = 0;
  private pendingMove: PointerSample | null = null;
  private pendingMoveTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private store: Store<State>,
    private socket: Socket,
    private screen: Screen,
    private getAssistVersion: () => number
  ) {
    window.addEventListener('message', this.onWindowMessage);
    socket.on('connect', this.onConnect);
    socket.on('SESSION_RECONNECTED', this.onSessionReconnected);
    socket.on('disconnect', this.onDisconnect);
    socket.on('SESSION_DISCONNECTED', this.onSessionDisconnected);
    if (socket.connected) {
      this.onConnect();
    }
  }

  private onWindowMessage = (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || data.type !== POINTER_MODE_MESSAGE_TYPE) return;
    if (data.mode !== 'off' && data.mode !== 'point') return;
    this.setMode(data.mode);
  };

  private onConnect = () => {
    this.syncModeIfPointing();
    window.parent.postMessage({ type: PLAYER_READY_MESSAGE_TYPE }, '*');
  };

  private onSessionReconnected = () => {
    this.syncModeIfPointing();
  };

  private onDisconnect = () => {
    this.modeSyncKey = null;
    this.clearPendingMove();
  };

  private onSessionDisconnected = () => {
    this.clearPendingMove();
  };

  private syncModeIfPointing() {
    this.modeSyncKey = null;
    if (this.mode === 'point') {
      this.pointAtCurrentTab();
    }
  }

  private setMode(mode: LiveViewPointerMode) {
    this.mode = mode;
    if (mode === 'point') {
      this.screen.overlay.addEventListener('mousemove', this.onMouseMove);
      this.screen.overlay.addEventListener('click', this.onClick);
      this.screen.overlay.style.cursor = 'crosshair';
      this.pointAtCurrentTab();
    } else {
      this.removeOverlayListeners();
      const tabId = this.getCurrentTab();
      this.turnOffPreviouslyPointedTab(tabId);
      this.emitMode('off', tabId);
    }
  }

  private pointAtCurrentTab() {
    const tabId = this.getCurrentTab();
    if (this.pendingMove && this.pendingMove.tabId !== tabId) {
      this.clearPendingMove();
    }
    this.turnOffPreviouslyPointedTab(tabId);
    this.emitMode('point', tabId);
  }

  private turnOffPreviouslyPointedTab(currentTabId?: string) {
    if (this.pointedTab && this.pointedTab.syncKey !== this.getModeSyncKey(currentTabId)) {
      this.emitData('live_view_mode', { mode: 'off' }, this.pointedTab.tabId);
    }
  }

  private removeOverlayListeners() {
    this.screen.overlay.removeEventListener('mousemove', this.onMouseMove);
    this.screen.overlay.removeEventListener('click', this.onClick);
    this.screen.overlay.style.cursor = '';
    this.clearPendingMove();
  }

  private clearPendingMove() {
    this.pendingMoveTimeout && clearTimeout(this.pendingMoveTimeout);
    this.pendingMoveTimeout = undefined;
    this.pendingMove = null;
  }

  private onMouseMove = (e: MouseEvent) => {
    const { x, y } = this.screen.getInternalCoordinates(e);
    this.pendingMove = { tabId: this.getCurrentTab(), coords: [x, y] };
    const waitMs = this.lastMoveSentAt + MOVE_THROTTLE_MS - Date.now();
    if (waitMs <= 0) {
      this.flushPendingMove();
    } else if (!this.pendingMoveTimeout) {
      this.pendingMoveTimeout = setTimeout(this.flushPendingMove, waitMs);
    }
  };

  private flushPendingMove = () => {
    this.pendingMoveTimeout = undefined;
    const move = this.pendingMove;
    this.pendingMove = null;
    if (!move || this.mode !== 'point') return;
    this.lastMoveSentAt = Date.now();
    this.emitPointerEvent('move', move);
  };

  private onClick = (e: MouseEvent) => {
    const { x, y } = this.screen.getInternalCoordinates(e);
    this.emitPointerEvent('live_view_pulse', { tabId: this.getCurrentTab(), coords: [x, y] });
  };

  private emitPointerEvent(event: 'move' | 'live_view_pulse', sample: PointerSample) {
    if (!this.socket.connected || sample.tabId !== this.getCurrentTab()) return;
    if (this.modeSyncKey !== this.getModeSyncKey(sample.tabId)) {
      this.pointAtCurrentTab();
    }
    this.emitData(event, sample.coords, sample.tabId);
  }

  private emitMode(mode: LiveViewPointerMode, tabId?: string) {
    this.modeSyncKey = this.getModeSyncKey(tabId);
    this.pointedTab = mode === 'point' ? { tabId, syncKey: this.modeSyncKey } : null;
    this.emitData('live_view_mode', { mode }, tabId);
  }

  private getCurrentTab() {
    return this.store.get().currentTab;
  }

  private getModeSyncKey(tabId?: string) {
    return `${this.getAssistVersion()}:${tabId}`;
  }

  private emitData(event: string, data: unknown, tabId?: string) {
    if (this.getAssistVersion() === 1) {
      this.socket.emit(event, data);
    } else {
      this.socket.emit(event, { meta: { tabId }, data });
    }
  }

  clean() {
    this.mode = 'off';
    this.removeOverlayListeners();
    window.removeEventListener('message', this.onWindowMessage);
    this.socket.off('connect', this.onConnect);
    this.socket.off('SESSION_RECONNECTED', this.onSessionReconnected);
    this.socket.off('disconnect', this.onDisconnect);
    this.socket.off('SESSION_DISCONNECTED', this.onSessionDisconnected);
  }
}
