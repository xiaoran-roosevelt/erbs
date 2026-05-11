/**
 * 二百四 — 游戏主页面逻辑
 * 移植自原 HTML 版本的模块 11-20
 */

const GLogic = require('../../utils/game-logic');
const Audio = require('../../utils/audio');

// ━━━ 默认玩家数据 ━━━
function defaultPlayers() {
  return [
    { name: '你',     score: 0, handCount: 0, active: false, rolePill: '', rolePillClass: '', handCards: [] },
    { name: 'AI一',   score: 0, handCount: 0, active: false, rolePill: '', rolePillClass: '', handCards: [] },
    { name: 'AI二',   score: 0, handCount: 0, active: false, rolePill: '', rolePillClass: '', handCards: [] },
    { name: 'AI三',   score: 0, handCount: 0, active: false, rolePill: '', rolePillClass: '', handCards: [] },
  ];
}

const SEAT_POS = { 0: 'rp-bottom', 1: 'rp-right', 2: 'rp-top', 3: 'rp-left' };

Page({
  data: {
    phase: 'lobby',
    subSuitDisplay: '正主',
    subSuitGold: false,
    roundNum: 1,
    humanScore: 0,
    cumScore: 0,
    cumScoreText: '±0',
    statusText: '准备中...',

    players: defaultPlayers(),
    myHand: [],

    showShoutPanel: false,
    shoutSuits: [],
    showCountdown: false,
    countdownText: '',
    showRevPanel: false,
    revOptions: [
      { key: 'bigjoker', label: '大王对', disabled: true },
      { key: 'smalljoker', label: '小王对', disabled: true },
      { key: '♠', label: '♠10对', disabled: true },
      { key: '♥', label: '♥10对', disabled: true },
      { key: '♣', label: '♣10对', disabled: true },
      { key: '♦', label: '♦10对', disabled: true },
      { key: 'pass', label: '过', disabled: false },
    ],
    showActionBar: false,

    subPlays: [],
    subWinner: -1,
    toasts: [],

    showEndScreen: false,
    endEmoji: '',
    endTitle: '',
    endTitleClass: '',
    endSub: '',
    endRows: [],
  },

  // ━━━ 内部状态（不在 data 中）━━━
  G: null,
  cumScores: [0, 0, 0, 0],
  roundNum: 0,
  sel: [],
  hintList: [],
  hintIdx: 0,
  dealTimer: null,
  cdTimer: null,
  toastId: 0,

  onLoad() {
    this.G = this._makeG();
  },

  onHide() {
    this._clearTimers();
  },

  onShow() {
    // 恢复时不做特殊处理，游戏状态保持
  },

  onUnload() {
    this._clearTimers();
  },

  _clearTimers() {
    if (this.dealTimer) { clearTimeout(this.dealTimer); this.dealTimer = null; }
    if (this.cdTimer) { clearTimeout(this.cdTimer); this.cdTimer = null; }
  },

  _makeG() {
    return {
      phase: 'lobby', deck: [],
      hands: [[], [], [], []],
      sub: null, shouter: -1,
      revBest: null, revWinner: -1,
      revPhaseStep: 0, revOtherArr: [], revOtherIdx: 0,
      mustLeadPair: null, firstSeat: 0,
      leader: -1, turnOrder: [], turnIdx: 0,
      roundCat: null, roundType: null,
      roundBestRank: -1, roundBestCatScore: -1,
      isLeader: false,
      subPlays: {}, subPlayCount: 0,
      scores: [0, 0, 0, 0],
      dealIdx: 0, dealSeat: 0,
      highScore: 0,
    };
  },

  // ══════════════════════════════════════════
  //  游戏入口
  // ══════════════════════════════════════════

  startGame() {
    this.setData({ phase: 'game' });
    this.G = this._makeG();
    this.cumScores = [0, 0, 0, 0];
    this.roundNum = 0;
    this.sel = [];
    this.hintList = [];
    this.hintIdx = 0;
    this._clearTimers();
    this.newRound();
  },

  newRound() {
    this._clearTimers();
    this.roundNum++;
    const deck = GLogic.shuffle(GLogic.makeDeck());

    Object.assign(this.G, {
      phase: 'deal', deck,
      hands: [[], [], [], []],
      sub: null, shouter: -1,
      revBest: null, revWinner: -1,
      revPhaseStep: 0, revOtherArr: [], revOtherIdx: 0,
      mustLeadPair: null,
      firstSeat: this.G.highScore || 0,
      leader: -1, turnOrder: [], turnIdx: 0,
      roundCat: null, roundType: null,
      roundBestRank: -1, roundBestCatScore: -1,
      isLeader: false,
      subPlays: {}, subPlayCount: 0,
      scores: [0, 0, 0, 0],
      dealIdx: 0,
      dealSeat: this.G.highScore || 0,
    });

    this.sel = []; this.hintList = []; this.hintIdx = 0;

    this.setData({
      phase: 'deal',
      roundNum: this.roundNum,
      subSuitDisplay: '正主',
      subSuitGold: false,
      humanScore: 0,
      cumScore: this.cumScores[0],
      cumScoreText: this._fmtDelta(this.cumScores[0]),
      statusText: '发牌中...',
      players: defaultPlayers(),
      myHand: [],
      showShoutPanel: false,
      showCountdown: false,
      showRevPanel: false,
      showActionBar: false,
      subPlays: [],
      subWinner: -1,
      toasts: [],
      showEndScreen: false,
    });

    this.G.dealIdx = 0;
    this.G.dealSeat = this.G.firstSeat;
    this.doDeals();
  },

  // ══════════════════════════════════════════
  //  发牌阶段
  // ══════════════════════════════════════════

  doDeals() {
    if (this.G.dealIdx >= 84) { this.onDealDone(); return; }
    const G = this.G;
    const seat = G.dealSeat;
    const card = G.deck[G.dealIdx++];
    G.dealSeat = (G.dealSeat + 1) % 4;
    G.hands[seat].push(card);
    this._addCardToHand(seat, card);
    Audio.SFX.deal();

    // AI 喊牌检查
    if (G.shouter < 0 && seat !== 0 && !card.joker && card.rank === '10') {
      const wantSuit = GLogic.aiPickShout(G.hands[seat]);
      if (wantSuit === card.suit) {
        const self = this;
        const s = seat, su = wantSuit;
        this.dealTimer = setTimeout(() => {
          if (self.G.shouter < 0) self._applyShout(s, su);
          self.dealTimer = setTimeout(() => self.doDeals(), 90);
        }, 300 + Math.random() * 600);
        return;
      }
    }

    // 人类拿到10
    if (seat === 0 && !card.joker && card.rank === '10') {
      this._refreshShoutPanel();
    }

    this.dealTimer = setTimeout(() => this.doDeals(), 90);
  },

  onDealDone() {
    this.setData({ showShoutPanel: false });
    for (let i = 0; i < 4; i++) this.G.hands[i] = GLogic.sortHand(this.G.hands[i], this.G.sub);
    this._syncAllHands();
    if (this.G.shouter >= 0) this.enterReverse();
    else this.startNoShoutCountdown();
  },

  onCardTap(e) {
    if (this.G.phase !== 'play' || this.G.turnOrder[this.G.turnIdx] !== 0) return;
    Audio.SFX.pick();
    this.hintList = []; this.hintIdx = 0;
    const uid = e.currentTarget.dataset.uid;
    const i = this.sel.indexOf(uid);
    if (i >= 0) this.sel.splice(i, 1);
    else this.sel.push(uid);
    this._syncMyHand();
  },

  // ══════════════════════════════════════════
  //  喊牌
  // ══════════════════════════════════════════

  _applyShout(seat, suit) {
    this.G.shouter = seat; this.G.sub = suit;
    this.setData({ subSuitDisplay: suit, subSuitGold: true, showShoutPanel: false });
    const who = seat === 0 ? '你' : GLogic.PNAME[seat];
    this.toast(`${who} 喊了 ${suit} 副主！`, 2200, 'tgold');
    Audio.SFX.shout();
    this._showRolePill(seat, '喊牌', 'rp-shout');
  },

  _refreshShoutPanel() {
    if (this.G.shouter >= 0) { this.setData({ showShoutPanel: false }); return; }
    const myTens = this.G.hands[0].filter(c => !c.joker && c.rank === '10');
    if (!myTens.length) return;
    const suits = [...new Set(myTens.map(c => c.suit))];
    const suitName = { '♠': '黑桃', '♥': '红桃', '♣': '梅花', '♦': '方块' };
    this.setData({
      showShoutPanel: true,
      shoutSuits: suits.map(s => ({ suit: s, name: suitName[s] }))
    });
  },

  humanShout(e) {
    const suit = e.currentTarget.dataset.suit;
    if (this.G.shouter >= 0) return;
    this._clearTimers();
    this.setData({ showCountdown: false });
    this._applyShout(0, suit);
    if (this.G.phase === 'countdown') {
      this.G.phase = 'reverse';
      for (let i = 0; i < 4; i++) this.G.hands[i] = GLogic.sortHand(this.G.hands[i], this.G.sub);
      this._syncAllHands();
      this.G.revWinner = 0;
      this.G.revOtherArr = [(this.G.shouter + 1) % 4, (this.G.shouter + 2) % 4, (this.G.shouter + 3) % 4];
      this.G.revOtherIdx = 0; this.G.revPhaseStep = 0;
      setTimeout(() => this.processRevOther(), 700);
    }
  },

  startNoShoutCountdown() {
    this.G.phase = 'countdown';
    let t = 5;
    const fs = this.G.firstSeat;
    this._refreshShoutPanel();
    const tick = () => {
      if (this.G.shouter >= 0) return;
      if (t <= 0) {
        this.setData({ showCountdown: false, showShoutPanel: false });
        this.toast('打正主！', 1800, 'tgold');
        this.startPlay();
        return;
      }
      this.setData({
        showCountdown: true,
        countdownText: `无人喊牌 → 打正主，${GLogic.PNAME[fs]} 首出 · ${t}s`,
        statusText: `无人喊牌——打正主，${GLogic.PNAME[fs]} 首出`
      });
      t--;
      this.cdTimer = setTimeout(tick, 1000);
    };
    tick();
  },

  // ══════════════════════════════════════════
  //  反牌阶段
  // ══════════════════════════════════════════

  enterReverse() {
    this.G.phase = 'reverse';
    this.G.revWinner = this.G.shouter;
    this.G.revOtherArr = [(this.G.shouter + 1) % 4, (this.G.shouter + 2) % 4, (this.G.shouter + 3) % 4];
    this.G.revOtherIdx = 0; this.G.revPhaseStep = 0;
    this.setData({ statusText: `进入反牌阶段，${GLogic.PNAME[this.G.shouter]} 喊牌` });
    setTimeout(() => this.processRevOther(), 800);
  },

  processRevOther() {
    if (this.G.revOtherIdx >= 3) {
      this.G.revPhaseStep = 1;
      if (this.G.revBest !== null) {
        const seat = this.G.shouter;
        if (seat === 0) this._showRevPanel();
        else this._aiRevStep(seat, true);
      } else {
        this.finishReverse();
      }
      return;
    }
    const seat = this.G.revOtherArr[this.G.revOtherIdx];
    if (seat === 0) this._showRevPanel();
    else this._aiRevStep(seat, false);
  },

  _aiRevStep(seat, isShouter) {
    this.setData({ statusText: `${GLogic.PNAME[seat]} 考虑反牌...` });
    const self = this;
    setTimeout(() => {
      const key = GLogic.aiPickReverse(self.G.hands[seat], self.G.revBest);
      if (key && GLogic.revBeats(key, self.G.revBest)) {
        self._doApplyReverse(seat, key);
        if (key === 'bigjoker' || key === 'smalljoker') { self.finishReverse(); return; }
      }
      if (isShouter) self.finishReverse();
      else { self.G.revOtherIdx++; self.processRevOther(); }
    }, 500 + Math.random() * 500);
  },

  _doApplyReverse(seat, key) {
    this.G.revBest = key; this.G.revWinner = seat;
    const isZ = key === 'bigjoker' || key === 'smalljoker';
    if (isZ) { this.G.sub = null; this.setData({ subSuitDisplay: '正主', subSuitGold: false }); }
    else { this.G.sub = key; this.setData({ subSuitDisplay: key, subSuitGold: true }); }
    for (let i = 0; i < 4; i++) this.G.hands[i] = GLogic.sortHand(this.G.hands[i], this.G.sub);
    this._syncAllHands();
    this.toast(isZ ? `${GLogic.PNAME[seat]} 打正主！` : `${GLogic.PNAME[seat]} 反了${key}10！`, 1800, 'tgold');
    Audio.SFX.shout();
    this._showRolePill(seat, '反牌', 'rp-rev');
  },

  _showRevPanel() {
    const h = this.G.hands[0];
    const can = (cond) => !!cond;
    const beats = (k) => GLogic.revBeats(k, this.G.revBest);

    const hasPair = (filterFn) => GLogic.findPairs(h.filter(filterFn)).length > 0;

    const opts = this.data.revOptions.map(opt => {
      if (opt.key === 'pass') return { ...opt, disabled: false };
      let ok = false;
      if (beats(opt.key)) {
        if (opt.key === 'bigjoker') ok = hasPair(c => c.joker && c.jokerType === 'big');
        else if (opt.key === 'smalljoker') ok = hasPair(c => c.joker && c.jokerType === 'small');
        else ok = hasPair(c => !c.joker && c.rank === '10' && c.suit === opt.key);
      }
      return { ...opt, disabled: !ok };
    });

    this.setData({ revOptions: opts, showRevPanel: true, statusText: '你是否反牌？' });
  },

  humanRev(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ showRevPanel: false });
    if (key && key !== 'pass' && GLogic.revBeats(key, this.G.revBest)) {
      this._doApplyReverse(0, key);
      if (key === 'bigjoker' || key === 'smalljoker') { this.finishReverse(); return; }
    }
    if (this.G.revPhaseStep === 1) this.finishReverse();
    else { this.G.revOtherIdx++; this.processRevOther(); }
  },

  finishReverse() {
    this.setData({ showRevPanel: false });
    for (let i = 0; i < 4; i++) this.G.hands[i] = GLogic.sortHand(this.G.hands[i], this.G.sub);
    this._syncAllHands();
    if (this.G.revBest) this.G.mustLeadPair = this.G.revBest;
    const sub = this.G.sub;
    this.setData({
      statusText: sub ? `副主：${sub} · ${GLogic.PNAME[this.G.revWinner]} 首出`
                      : `打正主 · ${GLogic.PNAME[this.G.revWinner]} 首出`
    });
    setTimeout(() => this.startPlay(), 600);
  },

  // ══════════════════════════════════════════
  //  出牌阶段
  // ══════════════════════════════════════════

  startPlay() {
    this.G.phase = 'play';
    this.G.leader = this.G.revWinner >= 0 ? this.G.revWinner : this.G.firstSeat;
    this.beginSubRound();
  },

  beginSubRound() {
    const G = this.G;
    G.turnOrder = [];
    for (let i = 0; i < 4; i++) G.turnOrder.push((G.leader + i) % 4);
    G.turnIdx = 0;
    G.roundCat = null; G.roundType = null;
    G.roundBestRank = -1; G.roundBestCatScore = -1;
    G.subPlays = {}; G.subPlayCount = 0;
    G.isLeader = true;

    this.setData({ subPlays: [], subWinner: -1 });
    this._setActiveDot(G.turnOrder[0]);
    this.setData({ statusText: `${GLogic.PNAME[G.leader]} 首出` });
    this.scheduleTurn();
  },

  scheduleTurn() {
    if (this.G.turnIdx >= 4) { this.resolveSubRound(); return; }
    const seat = this.G.turnOrder[this.G.turnIdx];
    const isLeader = (this.G.turnIdx === 0);
    this.G.isLeader = isLeader && (seat === 0);
    this._setActiveDot(seat);

    if (seat === 0) {
      this.humanPlayTurn(isLeader);
    } else {
      this.setData({ statusText: `${GLogic.PNAME[seat]} 出牌中...`, showActionBar: false });
      const self = this;
      setTimeout(() => self.aiPlayTurn(seat, isLeader), 600 + Math.random() * 500);
    }
  },

  humanPlayTurn(isLeader) {
    this.sel = []; this.hintList = []; this.hintIdx = 0;
    this.setData({ showActionBar: true, statusText: isLeader ? '轮到你首出' : '跟牌（必须出牌）' });
    this._syncMyHand();
  },

  aiPlayTurn(seat, isLeader) {
    const G = this.G;
    if (G.mustLeadPair && isLeader) {
      const pair = GLogic.getRevPairCards(G.hands[seat], G.mustLeadPair);
      if (pair) { G.mustLeadPair = null; this.commitPlay(seat, pair, isLeader); return; }
      G.mustLeadPair = null;
    }

    const play = GLogic.aiChoosePlay(G.hands[seat], G.roundCat, G.roundType, G.sub, isLeader);
    const n = G.roundType ? G.roundType.len * (G.roundType.type === 'single' ? 1 : 2) : null;

    let final = play || [];
    if (!isLeader && n && final.length !== n) {
      final = GLogic.pickFillN(G.hands[seat], n, G.sub);
    }
    if (!final.length) final = [G.hands[seat][0]];
    this.commitPlay(seat, final, isLeader);
  },

  doPlay() {
    if (!this.sel.length) { this.toast('请先选牌', 'tred'); return; }
    const hand = this.G.hands[0];
    const cards = this.sel.map(uid => hand.find(c => c.uid === uid)).filter(Boolean);

    if (this.G.isLeader && this.G.mustLeadPair) {
      const pair = GLogic.getRevPairCards(hand, this.G.mustLeadPair);
      if (pair && !pair.every(c => cards.find(x => x.uid === c.uid))) {
        this.toast('首出必须包含反牌对子', 'tred'); this._shakeHand(); return;
      }
    }

    const err = GLogic.validatePlay(cards, this.G);
    if (err) { this.toast(err, 'tred'); this._shakeHand(); return; }

    if (this.G.isLeader && this.G.mustLeadPair) this.G.mustLeadPair = null;

    this.commitPlay(0, cards, this.G.turnIdx === 0);
    this.setData({ showActionBar: false });
  },

  commitPlay(seat, cards, isLeader) {
    Audio.SFX.play();
    const G = this.G;
    const catScore = cat => (cat === 'main' ? 2 : cat === G.roundCat ? 1 : 0);

    if (isLeader) {
      G.roundCat = GLogic.cardCat(cards[0], G.sub);
      const pt = GLogic.getPlayType(cards, G.sub);
      if (pt.type === 'fill') return;
      G.roundType = pt;
      G.roundBestRank = pt.rank;
      G.roundBestCatScore = catScore(pt.cat);
    } else {
      const pt = GLogic.getPlayType(cards, G.sub);
      if (pt.type !== 'fill' && pt.type === G.roundType.type && pt.len === G.roundType.len) {
        const myCS = catScore(pt.cat);
        if (myCS > G.roundBestCatScore || (myCS === G.roundBestCatScore && pt.rank > G.roundBestRank)) {
          G.roundBestRank = pt.rank;
          G.roundBestCatScore = myCS;
        }
      }
    }

    const orderIdx = G.subPlayCount++;
    G.subPlays[seat] = { cards, orderIdx };

    const uidSet = new Set(cards.map(c => c.uid));
    G.hands[seat] = G.hands[seat].filter(c => !uidSet.has(c.uid));
    this._updateHandDisplay(seat);
    this._showSubPlay(seat, cards);

    G.turnIdx++;
    const self = this;
    setTimeout(() => self.scheduleTurn(), 280);
  },

  // ══════════════════════════════════════════
  //  子轮结算
  // ══════════════════════════════════════════

  resolveSubRound() {
    const G = this.G;
    const seats = Object.keys(G.subPlays).map(Number);
    let winnerSeat = seats[0];

    for (let i = 1; i < seats.length; i++) {
      const s = seats[i];
      const cmp = GLogic.comparePlay(
        G.subPlays[s].cards, G.subPlays[s].orderIdx,
        G.subPlays[winnerSeat].cards, G.subPlays[winnerSeat].orderIdx,
        G.roundCat, G.roundType, G.sub
      );
      if (cmp > 0) winnerSeat = s;
    }

    let gained = 0;
    for (const seat of seats) gained += GLogic.totalScore(G.subPlays[seat].cards);
    if (gained > 0) { G.scores[winnerSeat] += gained; Audio.SFX.score(); }
    this._updateScoreUI();
    this.setData({ subWinner: winnerSeat });

    const scoreMsg = gained > 0 ? ` +${gained}分` : '';
    this.toast(`${GLogic.PNAME[winnerSeat]} 赢得本轮${scoreMsg}`, 1600, gained > 0 ? 'tgold' : '');

    const self = this;
    setTimeout(() => {
      const anyEmpty = self.G.hands.some(h => h.length === 0);
      if (anyEmpty) { self.endRound(); return; }
      self.G.leader = winnerSeat;
      self.beginSubRound();
    }, 1400);
  },

  // ══════════════════════════════════════════
  //  提示系统
  // ══════════════════════════════════════════

  doHint() {
    if (!this.hintList.length || this.hintIdx >= this.hintList.length) {
      this.hintList = GLogic.buildHints(this.G.hands[0], this.G);
      this.hintIdx = 0;
      if (!this.hintList.length) { this.toast('无提示', 'tred'); return; }
    }
    this.sel = this.hintList[this.hintIdx].map(c => c.uid);
    this.hintIdx = (this.hintIdx + 1) % this.hintList.length;
    Audio.SFX.pick();
    this._syncMyHand();
  },

  // ══════════════════════════════════════════
  //  局结算
  // ══════════════════════════════════════════

  endRound() {
    const G = this.G;
    G.phase = 'end';

    let high = G.scores[0], highSeat = 0;
    for (let i = 1; i < 4; i++) if (G.scores[i] > high) { high = G.scores[i]; highSeat = i; }
    G.highScore = highSeat;

    const deltas = G.scores.map(s => s - 60);
    for (let i = 0; i < 4; i++) this.cumScores[i] += deltas[i];

    this._showEndScreen(deltas);
  },

  _showEndScreen(deltas) {
    const G = this.G;
    this.setData({ showActionBar: false });
    const md = deltas[0];
    const isTop = md === Math.max(...deltas);

    this.setData({
      showEndScreen: true,
      endEmoji: isTop ? '🎉' : md > 0 ? '😊' : md < 0 ? '😔' : '😐',
      endTitle: isTop ? '你赢了！' : md > 0 ? '小胜' : md === 0 ? '持平' : '你输了',
      endTitleClass: md > 0 ? 'win' : md < 0 ? 'lose' : 'tie',
      endSub: `下一局首出：${GLogic.PNAME[G.highScore]}（得分最高）`,
      endRows: [0, 1, 2, 3].map(i => ({
        seat: i,
        name: GLogic.PNAME[i],
        score: G.scores[i],
        delta: deltas[i],
        deltaText: (deltas[i] >= 0 ? '+' : '') + deltas[i],
        cum: this.cumScores[i],
        cumText: (this.cumScores[i] >= 0 ? '+' : '') + this.cumScores[i],
        isYou: i === 0,
      })),
    });

    if (md > 0) Audio.SFX.win();
    else if (md < 0) Audio.SFX.lose();
  },

  nextRound() {
    this.setData({ showEndScreen: false });
    this.newRound();
  },

  backLobby() {
    this.setData({ phase: 'lobby', showEndScreen: false });
    this._clearTimers();
  },

  // ══════════════════════════════════════════
  //  同步函数：将 G 状态同步到 data
  // ══════════════════════════════════════════

  _syncMyHand() {
    const curHint = this.hintList.length ? this.hintList[(this.hintIdx - 1 + this.hintList.length) % this.hintList.length] : null;
    const myHand = this.G.hands[0].map(c => ({
      ...c,
      selected: this.sel.includes(c.uid),
      hintHighlight: !!(curHint && curHint.find(x => x.uid === c.uid)),
    }));
    this.setData({ myHand });
  },

  _syncPlayerInfo(seat) {
    const G = this.G;
    const key = `players[${seat}]`;
    this.setData({
      [`${key}.score`]: G.scores[seat],
      [`${key}.handCount`]: G.hands[seat].length,
    });
  },

  _syncAllHands() {
    const players = this.data.players.map((p, i) => {
      const hc = this.G.hands[i].length;
      return {
        ...p,
        handCount: hc,
        handCards: i === 0 ? [] : this.G.hands[i].map(c => ({ uid: c.uid, suit: c.suit, rank: c.rank, joker: c.joker })),
        score: this.G.scores[i],
      };
    });
    this.setData({ players });
    this._syncMyHand();
  },

  _addCardToHand(seat, card) {
    // 只更新人类手牌渲染（AI牌仅更新计数）
    if (seat === 0) {
      this._syncMyHand();
    }
    this._syncPlayerInfo(seat);
    this._updateHcnts();
  },

  _updateHandDisplay(seat) {
    if (seat === 0) {
      this._syncMyHand();
      this._syncPlayerInfo(0);
      return;
    }
    // AI 手牌
    const key = `players[${seat}]`;
    this.setData({
      [`${key}.handCount`]: this.G.hands[seat].length,
      [`${key}.handCards`]: this.G.hands[seat].map(c => ({ uid: c.uid, suit: c.suit, rank: c.rank, joker: c.joker })),
    });
  },

  _updateHcnts() {
    const updates = {};
    for (let i = 0; i < 4; i++) {
      updates[`players[${i}].handCount`] = this.G.hands[i] ? this.G.hands[i].length : 0;
    }
    this.setData(updates);
  },

  _showSubPlay(seat, cards) {
    const sp = this.data.subPlays.filter(s => s.seat !== seat);
    sp.push({ seat, pos: SEAT_POS[seat], cards });
    this.setData({ subPlays: sp });
  },

  _updateScoreUI() {
    const G = this.G;
    const updates = {};
    for (let i = 0; i < 4; i++) {
      updates[`players[${i}].score`] = G.scores[i];
    }
    updates.humanScore = G.scores[0];
    updates.cumScore = this.cumScores[0];
    updates.cumScoreText = this._fmtDelta(this.cumScores[0]);
    this.setData(updates);
  },

  // ══════════════════════════════════════════
  //  UI 工具函数
  // ══════════════════════════════════════════

  toast(msg, dur, cls) {
    if (typeof dur === 'string') { cls = dur; dur = 2000; }
    dur = dur || 2000;
    const id = ++this.toastId;
    const toasts = this.data.toasts.concat({ id, text: msg, cls: cls || '', out: false });
    this.setData({ toasts });

    const self = this;
    setTimeout(() => {
      const ts = self.data.toasts.map(t => t.id === id ? { ...t, out: true } : t);
      self.setData({ toasts: ts });
      setTimeout(() => {
        self.setData({ toasts: self.data.toasts.filter(t => t.id !== id) });
      }, 220);
    }, dur);
  },

  _setStatus(text) {
    this.setData({ statusText: text });
  },

  _setActiveDot(seat) {
    const updates = {};
    for (let i = 0; i < 4; i++) {
      updates[`players[${i}].active`] = (i === seat);
    }
    this.setData(updates);
  },

  _showRolePill(seat, text, cls) {
    this.setData({
      [`players[${seat}].rolePill`]: text,
      [`players[${seat}].rolePillClass`]: cls,
    });
  },

  _shakeHand() {
    // WXSS animation trigger via class toggling is unreliable with setData timing
    // Simple vibration feedback instead
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  _fmtDelta(v) {
    if (v === 0) return '±0';
    return (v >= 0 ? '+' : '') + v;
  },
});
