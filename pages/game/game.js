/**
 * 二百四 — 游戏主页面逻辑
 * 移植自原 HTML 版本的模块 11-20
 */

var GLogic = require('../../utils/game-logic');
var Audio = require('../../utils/audio');

function defaultPlayers() {
  return [
    { name: '你',   score: 0, handCount: 0, active: false, rolePill: '', rolePillClass: '', handCards: [] },
    { name: 'AI一', score: 0, handCount: 0, active: false, rolePill: '', rolePillClass: '', handCards: [] },
    { name: 'AI二', score: 0, handCount: 0, active: false, rolePill: '', rolePillClass: '', handCards: [] },
    { name: 'AI三', score: 0, handCount: 0, active: false, rolePill: '', rolePillClass: '', handCards: [] },
  ];
}

var SEAT_POS = { 0: 'rp-bottom', 1: 'rp-right', 2: 'rp-top', 3: 'rp-left' };

Page({
  data: {
    phase: 'lobby',
    isLandscape: true,
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

  // ━━━ 内部状态 ━━━
  G: null,
  cumScores: [0, 0, 0, 0],
  roundNum: 0,
  sel: [],
  hintList: [],
  hintIdx: 0,
  dealTimer: null,
  cdTimer: null,
  toastId: 0,
  _syncPending: false,
  _syncTimer: null,

  onLoad: function () {
    this.G = this._makeG();
    this._detectOrientation();
  },

  onHide: function () {
    // 不清除发牌计时器，避免打断发牌链
    if (this.cdTimer) { clearTimeout(this.cdTimer); this.cdTimer = null; }
    if (this._syncTimer) { clearTimeout(this._syncTimer); this._syncTimer = null; }
  },

  onShow: function () {
    // 如果发牌中断（切后台回来），恢复发牌
    if (this.G && this.G.phase === 'deal' && !this.dealTimer) {
      console.log('[onShow] 恢复发牌, dealIdx=' + this.G.dealIdx);
      var self = this;
      this.dealTimer = setTimeout(function () { self.doDeals(); }, 90);
    }
  },

  onResize: function (res) {
    this.setData({ isLandscape: res.size.windowWidth > res.size.windowHeight });
  },

  _detectOrientation: function () {
    var info = wx.getSystemInfoSync();
    this.setData({ isLandscape: info.windowWidth > info.windowHeight });
  },

  onUnload: function () {
    this._clearTimers();
  },

  _clearTimers: function () {
    if (this.dealTimer) { clearTimeout(this.dealTimer); this.dealTimer = null; }
    if (this.cdTimer) { clearTimeout(this.cdTimer); this.cdTimer = null; }
    if (this._syncTimer) { clearTimeout(this._syncTimer); this._syncTimer = null; }
  },

  _makeG: function () {
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

  startGame: function () {
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

  newRound: function () {
    this._clearTimers();
    this.roundNum++;
    var deck = GLogic.shuffle(GLogic.makeDeck());

    Object.assign(this.G, {
      phase: 'deal', deck: deck,
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

    this.doDeals();
  },

  // ══════════════════════════════════════════
  //  发牌阶段
  // ══════════════════════════════════════════

  doDeals: function () {
    console.log('[doDeals] dealIdx=' + this.G.dealIdx);
    if (this.G.dealIdx >= 84) { this.onDealDone(); return; }

    try {
      var G = this.G;
      var seat = G.dealSeat;
      var card = G.deck[G.dealIdx++];
      G.dealSeat = (G.dealSeat + 1) % 4;
      G.hands[seat].push(card);

      this._addCardToHand(seat, card);
      Audio.SFX.deal();

      // AI 喊牌检查
      if (G.shouter < 0 && seat !== 0 && !card.joker && card.rank === '10') {
        var wantSuit = GLogic.aiPickShout(G.hands[seat]);
        if (wantSuit === card.suit) {
          var self = this;
          var s = seat, su = wantSuit;
          this.dealTimer = setTimeout(function () {
            if (self.G.shouter < 0) self._applyShout(s, su);
            self.dealTimer = setTimeout(function () { self.doDeals(); }, 90);
          }, 300 + Math.random() * 600);
          return;
        }
      }

      // 人类拿到10
      if (seat === 0 && !card.joker && card.rank === '10') {
        this._refreshShoutPanel();
      }
    } catch (e) {
      console.error('[doDeals] 发牌出错:', e);
    }

    var self = this;
    this.dealTimer = setTimeout(function () { self.doDeals(); }, 90);
  },

  onDealDone: function () {
    this.setData({ showShoutPanel: false });
    for (var i = 0; i < 4; i++) this.G.hands[i] = GLogic.sortHand(this.G.hands[i], this.G.sub);
    this._syncAllHands();
    if (this.G.shouter >= 0) this.enterReverse();
    else this.startNoShoutCountdown();
  },

  onCardTap: function (e) {
    if (this.G.phase !== 'play' || this.G.turnOrder[this.G.turnIdx] !== 0) return;
    Audio.SFX.pick();
    this.hintList = []; this.hintIdx = 0;
    var uid = e.currentTarget.dataset.uid;
    var i = this.sel.indexOf(uid);
    if (i >= 0) this.sel.splice(i, 1);
    else this.sel.push(uid);
    this._syncMyHand();
  },

  // ══════════════════════════════════════════
  //  喊牌
  // ══════════════════════════════════════════

  _applyShout: function (seat, suit) {
    this.G.shouter = seat; this.G.sub = suit;
    this.setData({ subSuitDisplay: suit, subSuitGold: true, showShoutPanel: false });
    var who = seat === 0 ? '你' : GLogic.PNAME[seat];
    this.toast(who + ' 喊了 ' + suit + ' 副主！', 2200, 'tgold');
    Audio.SFX.shout();
    this._showRolePill(seat, '喊牌', 'rp-shout');
  },

  _refreshShoutPanel: function () {
    if (this.G.shouter >= 0) { this.setData({ showShoutPanel: false }); return; }
    var myTens = this.G.hands[0].filter(function (c) { return !c.joker && c.rank === '10'; });
    if (!myTens.length) return;
    var suits = [];
    for (var i = 0; i < myTens.length; i++) {
      if (suits.indexOf(myTens[i].suit) < 0) suits.push(myTens[i].suit);
    }
    var suitName = { '♠': '黑桃', '♥': '红桃', '♣': '梅花', '♦': '方块' };
    this.setData({
      showShoutPanel: true,
      shoutSuits: suits.map(function (s) { return { suit: s, name: suitName[s] }; })
    });
  },

  humanShout: function (e) {
    var suit = e.currentTarget.dataset.suit;
    if (this.G.shouter >= 0) return;
    this._clearTimers();
    this.setData({ showCountdown: false });
    this._applyShout(0, suit);
    if (this.G.phase === 'countdown') {
      this.G.phase = 'reverse';
      for (var i = 0; i < 4; i++) this.G.hands[i] = GLogic.sortHand(this.G.hands[i], this.G.sub);
      this._syncAllHands();
      this.G.revWinner = 0;
      this.G.revOtherArr = [(this.G.shouter + 1) % 4, (this.G.shouter + 2) % 4, (this.G.shouter + 3) % 4];
      this.G.revOtherIdx = 0; this.G.revPhaseStep = 0;
      var self = this;
      setTimeout(function () { self.processRevOther(); }, 700);
    }
  },

  startNoShoutCountdown: function () {
    this.G.phase = 'countdown';
    var t = 5;
    var fs = this.G.firstSeat;
    this._refreshShoutPanel();
    var self = this;
    var tick = function () {
      if (self.G.shouter >= 0) return;
      if (t <= 0) {
        self.setData({ showCountdown: false, showShoutPanel: false });
        self.toast('打正主！', 1800, 'tgold');
        self.startPlay();
        return;
      }
      self.setData({
        showCountdown: true,
        countdownText: '无人喊牌 → 打正主，' + GLogic.PNAME[fs] + ' 首出 · ' + t + 's',
        statusText: '无人喊牌——打正主，' + GLogic.PNAME[fs] + ' 首出'
      });
      t--;
      self.cdTimer = setTimeout(tick, 1000);
    };
    tick();
  },

  // ══════════════════════════════════════════
  //  反牌阶段
  // ══════════════════════════════════════════

  enterReverse: function () {
    this.G.phase = 'reverse';
    this.G.revWinner = this.G.shouter;
    this.G.revOtherArr = [(this.G.shouter + 1) % 4, (this.G.shouter + 2) % 4, (this.G.shouter + 3) % 4];
    this.G.revOtherIdx = 0; this.G.revPhaseStep = 0;
    this.setData({ statusText: '进入反牌阶段，' + GLogic.PNAME[this.G.shouter] + ' 喊牌' });
    var self = this;
    setTimeout(function () { self.processRevOther(); }, 800);
  },

  processRevOther: function () {
    if (this.G.revOtherIdx >= 3) {
      this.G.revPhaseStep = 1;
      if (this.G.revBest !== null) {
        var seat = this.G.shouter;
        if (seat === 0) this._showRevPanel();
        else this._aiRevStep(seat, true);
      } else {
        this.finishReverse();
      }
      return;
    }
    var s = this.G.revOtherArr[this.G.revOtherIdx];
    if (s === 0) this._showRevPanel();
    else this._aiRevStep(s, false);
  },

  _aiRevStep: function (seat, isShouter) {
    this.setData({ statusText: GLogic.PNAME[seat] + ' 考虑反牌...' });
    var self = this;
    setTimeout(function () {
      var key = GLogic.aiPickReverse(self.G.hands[seat], self.G.revBest);
      if (key && GLogic.revBeats(key, self.G.revBest)) {
        self._doApplyReverse(seat, key);
        if (key === 'bigjoker' || key === 'smalljoker') { self.finishReverse(); return; }
      }
      if (isShouter) self.finishReverse();
      else { self.G.revOtherIdx++; self.processRevOther(); }
    }, 500 + Math.random() * 500);
  },

  _doApplyReverse: function (seat, key) {
    this.G.revBest = key; this.G.revWinner = seat;
    var isZ = key === 'bigjoker' || key === 'smalljoker';
    if (isZ) { this.G.sub = null; this.setData({ subSuitDisplay: '正主', subSuitGold: false }); }
    else { this.G.sub = key; this.setData({ subSuitDisplay: key, subSuitGold: true }); }
    for (var i = 0; i < 4; i++) this.G.hands[i] = GLogic.sortHand(this.G.hands[i], this.G.sub);
    this._syncAllHands();
    this.toast(isZ ? GLogic.PNAME[seat] + ' 打正主！' : GLogic.PNAME[seat] + ' 反了' + key + '10！', 1800, 'tgold');
    Audio.SFX.shout();
    this._showRolePill(seat, '反牌', 'rp-rev');
  },

  _showRevPanel: function () {
    var h = this.G.hands[0];
    var self = this;
    var beats = function (k) { return GLogic.revBeats(k, self.G.revBest); };
    var hasPair = function (fn) { return GLogic.findPairs(h.filter(fn)).length > 0; };

    var opts = this.data.revOptions.map(function (opt) {
      if (opt.key === 'pass') return { key: 'pass', label: '过', disabled: false };
      var ok = false;
      if (beats(opt.key)) {
        if (opt.key === 'bigjoker') ok = hasPair(function (c) { return c.joker && c.jokerType === 'big'; });
        else if (opt.key === 'smalljoker') ok = hasPair(function (c) { return c.joker && c.jokerType === 'small'; });
        else ok = hasPair(function (c) { return !c.joker && c.rank === '10' && c.suit === opt.key; });
      }
      return { key: opt.key, label: opt.label, disabled: !ok };
    });

    this.setData({ revOptions: opts, showRevPanel: true, statusText: '你是否反牌？' });
  },

  humanRev: function (e) {
    var key = e.currentTarget.dataset.key;
    this.setData({ showRevPanel: false });
    if (key && key !== 'pass' && GLogic.revBeats(key, this.G.revBest)) {
      this._doApplyReverse(0, key);
      if (key === 'bigjoker' || key === 'smalljoker') { this.finishReverse(); return; }
    }
    if (this.G.revPhaseStep === 1) this.finishReverse();
    else { this.G.revOtherIdx++; this.processRevOther(); }
  },

  finishReverse: function () {
    this.setData({ showRevPanel: false });
    for (var i = 0; i < 4; i++) this.G.hands[i] = GLogic.sortHand(this.G.hands[i], this.G.sub);
    this._syncAllHands();
    if (this.G.revBest) this.G.mustLeadPair = this.G.revBest;
    var sub = this.G.sub;
    this.setData({
      statusText: sub ? '副主：' + sub + ' · ' + GLogic.PNAME[this.G.revWinner] + ' 首出'
                      : '打正主 · ' + GLogic.PNAME[this.G.revWinner] + ' 首出'
    });
    var self = this;
    setTimeout(function () { self.startPlay(); }, 600);
  },

  // ══════════════════════════════════════════
  //  出牌阶段
  // ══════════════════════════════════════════

  startPlay: function () {
    this.G.phase = 'play';
    this.G.leader = this.G.revWinner >= 0 ? this.G.revWinner : this.G.firstSeat;
    this.beginSubRound();
  },

  beginSubRound: function () {
    var G = this.G;
    G.turnOrder = [];
    for (var i = 0; i < 4; i++) G.turnOrder.push((G.leader + i) % 4);
    G.turnIdx = 0;
    G.roundCat = null; G.roundType = null;
    G.roundBestRank = -1; G.roundBestCatScore = -1;
    G.subPlays = {}; G.subPlayCount = 0;
    G.isLeader = true;

    this.setData({ subPlays: [], subWinner: -1 });
    this._setActiveDot(G.turnOrder[0]);
    this.setData({ statusText: GLogic.PNAME[G.leader] + ' 首出' });
    this.scheduleTurn();
  },

  scheduleTurn: function () {
    if (this.G.turnIdx >= 4) { this.resolveSubRound(); return; }
    var seat = this.G.turnOrder[this.G.turnIdx];
    var isLeader = (this.G.turnIdx === 0);
    this.G.isLeader = isLeader && (seat === 0);
    this._setActiveDot(seat);

    if (seat === 0) {
      this.humanPlayTurn(isLeader);
    } else {
      this.setData({ statusText: GLogic.PNAME[seat] + ' 出牌中...', showActionBar: false });
      var self = this;
      setTimeout(function () { self.aiPlayTurn(seat, isLeader); }, 600 + Math.random() * 500);
    }
  },

  humanPlayTurn: function (isLeader) {
    this.sel = []; this.hintList = []; this.hintIdx = 0;
    this.setData({ showActionBar: true, statusText: isLeader ? '轮到你首出' : '跟牌（必须出牌）' });
    this._syncMyHand();
  },

  aiPlayTurn: function (seat, isLeader) {
    var G = this.G;
    if (G.mustLeadPair && isLeader) {
      var pair = GLogic.getRevPairCards(G.hands[seat], G.mustLeadPair);
      if (pair) { G.mustLeadPair = null; this.commitPlay(seat, pair, isLeader); return; }
      G.mustLeadPair = null;
    }

    var play = GLogic.aiChoosePlay(G.hands[seat], G.roundCat, G.roundType, G.sub, isLeader);
    var n = G.roundType ? G.roundType.len * (G.roundType.type === 'single' ? 1 : 2) : null;

    var final = play || [];
    if (!isLeader && n && final.length !== n) {
      final = GLogic.pickFillN(G.hands[seat], n, G.sub);
    }
    if (!final.length) final = [G.hands[seat][0]];
    this.commitPlay(seat, final, isLeader);
  },

  doPlay: function () {
    if (!this.sel.length) { this.toast('请先选牌', 'tred'); return; }
    var hand = this.G.hands[0];
    var cards = this.sel.map(function (uid) {
      for (var i = 0; i < hand.length; i++) { if (hand[i].uid === uid) return hand[i]; }
      return null;
    }).filter(Boolean);

    if (this.G.isLeader && this.G.mustLeadPair) {
      var pair = GLogic.getRevPairCards(hand, this.G.mustLeadPair);
      if (pair && !pair.every(function (c) {
        for (var i = 0; i < cards.length; i++) { if (cards[i].uid === c.uid) return true; }
        return false;
      })) {
        this.toast('首出必须包含反牌对子', 'tred'); this._shakeHand(); return;
      }
    }

    var err = GLogic.validatePlay(cards, this.G);
    if (err) { this.toast(err, 'tred'); this._shakeHand(); return; }

    if (this.G.isLeader && this.G.mustLeadPair) this.G.mustLeadPair = null;

    this.commitPlay(0, cards, this.G.turnIdx === 0);
    this.setData({ showActionBar: false });
  },

  commitPlay: function (seat, cards, isLeader) {
    Audio.SFX.play();
    var G = this.G;
    var catScore = function (cat) { return cat === 'main' ? 2 : cat === G.roundCat ? 1 : 0; };

    if (isLeader) {
      G.roundCat = GLogic.cardCat(cards[0], G.sub);
      var pt = GLogic.getPlayType(cards, G.sub);
      if (pt.type === 'fill') return;
      G.roundType = pt;
      G.roundBestRank = pt.rank;
      G.roundBestCatScore = catScore(pt.cat);
    } else {
      var pt2 = GLogic.getPlayType(cards, G.sub);
      if (pt2.type !== 'fill' && pt2.type === G.roundType.type && pt2.len === G.roundType.len) {
        var myCS = catScore(pt2.cat);
        if (myCS > G.roundBestCatScore || (myCS === G.roundBestCatScore && pt2.rank > G.roundBestRank)) {
          G.roundBestRank = pt2.rank;
          G.roundBestCatScore = myCS;
        }
      }
    }

    var orderIdx = G.subPlayCount++;
    G.subPlays[seat] = { cards: cards, orderIdx: orderIdx };

    var uidSet = {};
    for (var i = 0; i < cards.length; i++) uidSet[cards[i].uid] = true;
    G.hands[seat] = G.hands[seat].filter(function (c) { return !uidSet[c.uid]; });
    this._updateHandDisplay(seat);
    this._showSubPlay(seat, cards);

    G.turnIdx++;
    var self = this;
    setTimeout(function () { self.scheduleTurn(); }, 280);
  },

  // ══════════════════════════════════════════
  //  子轮结算
  // ══════════════════════════════════════════

  resolveSubRound: function () {
    var G = this.G;
    var sKeys = Object.keys(G.subPlays);
    var seats = sKeys.map(Number);
    var winnerSeat = seats[0];

    for (var i = 1; i < seats.length; i++) {
      var s = seats[i];
      var cmp = GLogic.comparePlay(
        G.subPlays[s].cards, G.subPlays[s].orderIdx,
        G.subPlays[winnerSeat].cards, G.subPlays[winnerSeat].orderIdx,
        G.roundCat, G.roundType, G.sub
      );
      if (cmp > 0) winnerSeat = s;
    }

    var gained = 0;
    for (var j = 0; j < seats.length; j++) gained += GLogic.totalScore(G.subPlays[seats[j]].cards);
    if (gained > 0) { G.scores[winnerSeat] += gained; Audio.SFX.score(); }
    this._updateScoreUI();
    this.setData({ subWinner: winnerSeat });

    var scoreMsg = gained > 0 ? ' +' + gained + '分' : '';
    this.toast(GLogic.PNAME[winnerSeat] + ' 赢得本轮' + scoreMsg, 1600, gained > 0 ? 'tgold' : '');

    var self = this;
    setTimeout(function () {
      var anyEmpty = self.G.hands.some(function (h) { return h.length === 0; });
      if (anyEmpty) { self.endRound(); return; }
      self.G.leader = winnerSeat;
      self.beginSubRound();
    }, 1400);
  },

  // ══════════════════════════════════════════
  //  提示系统
  // ══════════════════════════════════════════

  doHint: function () {
    if (!this.hintList.length || this.hintIdx >= this.hintList.length) {
      this.hintList = GLogic.buildHints(this.G.hands[0], this.G);
      this.hintIdx = 0;
      if (!this.hintList.length) { this.toast('无提示', 'tred'); return; }
    }
    this.sel = this.hintList[this.hintIdx].map(function (c) { return c.uid; });
    this.hintIdx = (this.hintIdx + 1) % this.hintList.length;
    Audio.SFX.pick();
    this._syncMyHand();
  },

  // ══════════════════════════════════════════
  //  局结算
  // ══════════════════════════════════════════

  endRound: function () {
    var G = this.G;
    G.phase = 'end';

    var high = G.scores[0], highSeat = 0;
    for (var i = 1; i < 4; i++) if (G.scores[i] > high) { high = G.scores[i]; highSeat = i; }
    G.highScore = highSeat;

    var deltas = G.scores.map(function (s) { return s - 60; });
    for (var i = 0; i < 4; i++) this.cumScores[i] += deltas[i];

    this._showEndScreen(deltas);
  },

  _showEndScreen: function (deltas) {
    var G = this.G;
    this.setData({ showActionBar: false });
    var md = deltas[0];
    var isTop = true;
    for (var i = 1; i < deltas.length; i++) { if (deltas[i] > md) isTop = false; }

    this.setData({
      showEndScreen: true,
      endEmoji: isTop ? '🎉' : md > 0 ? '😊' : md < 0 ? '😔' : '😐',
      endTitle: isTop ? '你赢了！' : md > 0 ? '小胜' : md === 0 ? '持平' : '你输了',
      endTitleClass: md > 0 ? 'win' : md < 0 ? 'lose' : 'tie',
      endSub: '下一局首出：' + GLogic.PNAME[G.highScore] + '（得分最高）',
      endRows: [0, 1, 2, 3].map(function (i) {
        return {
          seat: i,
          name: GLogic.PNAME[i],
          score: G.scores[i],
          delta: deltas[i],
          deltaText: (deltas[i] >= 0 ? '+' : '') + deltas[i],
          cum: this.cumScores[i],
          cumText: (this.cumScores[i] >= 0 ? '+' : '') + this.cumScores[i],
          isYou: i === 0,
        };
      }.bind(this)),
    });

    if (md > 0) Audio.SFX.win();
    else if (md < 0) Audio.SFX.lose();
  },

  nextRound: function () {
    this.setData({ showEndScreen: false });
    this.newRound();
  },

  backLobby: function () {
    this.setData({ phase: 'lobby', showEndScreen: false });
    this._clearTimers();
  },

  // ══════════════════════════════════════════
  //  同步函数
  // ══════════════════════════════════════════

  _syncMyHand: function () {
    var curHint = this.hintList.length ? this.hintList[(this.hintIdx - 1 + this.hintList.length) % this.hintList.length] : null;
    var myHand = this.G.hands[0].map(function (c) {
      return {
        uid: c.uid, suit: c.suit, rank: c.rank, joker: c.joker, jokerType: c.jokerType,
        selected: this.sel.indexOf(c.uid) >= 0,
        hintHighlight: !!(curHint && curHint.some(function (x) { return x.uid === c.uid; })),
      };
    }.bind(this));
    this.setData({ myHand: myHand });
  },

  _syncPlayerInfo: function (seat) {
    var G = this.G;
    var updates = {};
    updates['players[' + seat + '].score'] = G.scores[seat];
    updates['players[' + seat + '].handCount'] = G.hands[seat].length;
    this.setData(updates);
  },

  _syncAllHands: function () {
    var players = this.data.players.map(function (p, i) {
      var hc = this.G.hands[i].length;
      return {
        name: p.name,
        score: this.G.scores[i],
        handCount: hc,
        active: p.active,
        rolePill: p.rolePill,
        rolePillClass: p.rolePillClass,
        handCards: i === 0 ? [] : this.G.hands[i].map(function (c) {
          return { uid: c.uid, suit: c.suit, rank: c.rank, joker: c.joker };
        }),
      };
    }.bind(this));
    this.setData({ players: players });
    this._syncMyHand();
  },

  _addCardToHand: function (seat, card) {
    if (seat === 0) {
      // 合并为单次 setData，同时更新 myHand 和 handCount
      var curHint = this.hintList.length ? this.hintList[(this.hintIdx - 1 + this.hintList.length) % this.hintList.length] : null;
      var myHand = this.G.hands[0].map(function (c) {
        return {
          uid: c.uid, suit: c.suit, rank: c.rank, joker: c.joker, jokerType: c.jokerType,
          selected: this.sel.indexOf(c.uid) >= 0,
          hintHighlight: !!(curHint && curHint.some(function (x) { return x.uid === c.uid; })),
        };
      }.bind(this));
      var upd = { myHand: myHand };
      upd['players[0].handCount'] = this.G.hands[0].length;
      this.setData(upd);
    } else {
      var handCards = this.data.players[seat].handCards.concat([
        { uid: card.uid, suit: card.suit, rank: card.rank, joker: card.joker }
      ]);
      var updates = {};
      updates['players[' + seat + '].handCards'] = handCards;
      updates['players[' + seat + '].handCount'] = this.G.hands[seat].length;
      this.setData(updates);
    }
  },

  _updateHandDisplay: function (seat) {
    if (seat === 0) {
      this._syncMyHand();
      this.setData({ 'players[0].handCount': this.G.hands[0].length });
      return;
    }
    var handCards = this.G.hands[seat].map(function (c) {
      return { uid: c.uid, suit: c.suit, rank: c.rank, joker: c.joker };
    });
    var updates = {};
    updates['players[' + seat + '].handCount'] = this.G.hands[seat].length;
    updates['players[' + seat + '].handCards'] = handCards;
    this.setData(updates);
  },

  _showSubPlay: function (seat, cards) {
    var sp = this.data.subPlays.filter(function (s) { return s.seat !== seat; });
    sp.push({ seat: seat, pos: SEAT_POS[seat], cards: cards });
    this.setData({ subPlays: sp });
  },

  _updateScoreUI: function () {
    var G = this.G;
    var updates = {};
    for (var i = 0; i < 4; i++) {
      updates['players[' + i + '].score'] = G.scores[i];
    }
    updates.humanScore = G.scores[0];
    updates.cumScore = this.cumScores[0];
    updates.cumScoreText = this._fmtDelta(this.cumScores[0]);
    this.setData(updates);
  },

  // ══════════════════════════════════════════
  //  UI 工具函数
  // ══════════════════════════════════════════

  toast: function (msg, dur, cls) {
    if (typeof dur === 'string') { cls = dur; dur = 2000; }
    dur = dur || 2000;
    var id = ++this.toastId;
    var toasts = this.data.toasts.concat({ id: id, text: msg, cls: cls || '', out: false });
    this.setData({ toasts: toasts });
    var self = this;
    setTimeout(function () {
      var ts = self.data.toasts.map(function (t) { return t.id === id ? { id: t.id, text: t.text, cls: t.cls, out: true } : t; });
      self.setData({ toasts: ts });
      setTimeout(function () {
        self.setData({ toasts: self.data.toasts.filter(function (t) { return t.id !== id; }) });
      }, 220);
    }, dur);
  },

  _setActiveDot: function (seat) {
    var updates = {};
    for (var i = 0; i < 4; i++) {
      updates['players[' + i + '].active'] = (i === seat);
    }
    this.setData(updates);
  },

  _showRolePill: function (seat, text, cls) {
    var updates = {};
    updates['players[' + seat + '].rolePill'] = text;
    updates['players[' + seat + '].rolePillClass'] = cls;
    this.setData(updates);
  },

  _shakeHand: function () {
    wx.vibrateShort && wx.vibrateShort({ type: 'light' });
  },

  _fmtDelta: function (v) {
    if (v === 0) return '±0';
    return (v >= 0 ? '+' : '') + v;
  },
});
