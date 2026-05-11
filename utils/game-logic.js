/**
 * 二百四 — 纯游戏逻辑（模块3-10）
 * 从原 HTML 移植，保持函数签名和数据格式不变。
 * 所有函数为纯函数，不依赖 DOM 或全局状态。
 */

// ━━━ 常量 ━━━

const SUITS = ['♠', '♥', '♣', '♦'];
const NORMAL_RANKS = ['A', '2', '5', '7', '8', '9', '10', 'J', 'Q', 'K'];
const PNAME = ['你', 'AI一', 'AI二', 'AI三'];
const REV_ORDER = ['♦', '♣', '♥', '♠', 'smalljoker', 'bigjoker'];

// ━━━ 牌组生成 ━━━

function makeDeck() {
  const base = [];
  for (const s of SUITS) for (const r of NORMAL_RANKS) base.push({ suit: s, rank: r, joker: false });
  base.push({ suit: '🃏', rank: '大', joker: true, jokerType: 'big' });
  base.push({ suit: '🃏', rank: '大', joker: true, jokerType: 'big' });
  base.push({ suit: '🎴', rank: '小', joker: true, jokerType: 'small' });
  base.push({ suit: '🎴', rank: '小', joker: true, jokerType: 'small' });
  let uid = 0;
  const deck = [];
  for (const c of base) {
    deck.push({ ...c, uid: uid++ });
    if (!c.joker) deck.push({ ...c, uid: uid++ });
  }
  return deck;
}

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = 0 | Math.random() * (i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// ━━━ 牌的权值系统 ━━━

function cardRank(c, sub) {
  if (c.joker) return c.jokerType === 'big' ? (sub ? 14 : 18) : (sub ? 13 : 17);

  if (c.rank === '10') {
    if (!sub) { const i = ['♦', '♣', '♥', '♠'].indexOf(c.suit); return 13 + i; }
    return c.suit === sub ? 12 : 11;
  }

  if (c.rank === '2') {
    if (!sub) { const i = ['♦', '♣', '♥', '♠'].indexOf(c.suit); return 9 + i; }
    return c.suit === sub ? 10 : 9;
  }

  const t = { 5: 1, 7: 2, 8: 3, 9: 4, J: 5, Q: 6, K: 7, A: 8 };
  return t[c.rank] || 0;
}

function cardCat(c, sub) {
  if (c.joker) return 'main';
  if (c.rank === '10' || c.rank === '2') return 'main';
  if (sub && c.suit === sub) return 'main';
  return c.suit;
}

function cardScore(c) {
  if (c.joker) return 10;
  if (c.rank === '10') return 10;
  if (c.rank === 'K') return 10;
  if (c.rank === '5') return 5;
  return 0;
}

function totalScore(cards) {
  return (cards || []).reduce((s, c) => s + cardScore(c), 0);
}

// ━━━ 对子与连队检测 ━━━

function isPair(a, b) {
  if (!a || !b || a.uid === b.uid) return false;
  if (a.joker && b.joker) return a.jokerType === b.jokerType;
  if (a.joker || b.joker) return false;
  return a.rank === b.rank && a.suit === b.suit;
}

function findPairs(hand) {
  const r = [];
  for (let i = 0; i < hand.length; i++)
    for (let j = i + 1; j < hand.length; j++)
      if (isPair(hand[i], hand[j])) r.push([hand[i], hand[j]]);
  return r;
}

function findAllSeqs(cards, len, sub) {
  const pairs = findPairs(cards);
  const byRank = {};
  for (const p of pairs) {
    const r = cardRank(p[0], sub);
    if (!byRank[r]) byRank[r] = p;
  }
  const ranks = Object.keys(byRank).map(Number).sort((a, b) => a - b);
  const res = [];
  for (let s = 0; s <= ranks.length - len; s++) {
    const run = ranks.slice(s, s + len);
    let ok = true;
    for (let i = 1; i < run.length; i++) if (run[i] - run[i - 1] !== 1) { ok = false; break; }
    if (ok) {
      const play = [];
      for (const r of run) play.push(...byRank[r]);
      res.push({ play, minRank: run[0] });
    }
  }
  return res.sort((a, b) => b.minRank - a.minRank);
}

// ━━━ 牌型识别 ━━━

function getPlayType(cards, sub) {
  if (!cards || !cards.length) return null;
  const n = cards.length;

  const cats = [...new Set(cards.map(c => cardCat(c, sub)))];
  if (cats.length > 1) return { type: 'fill', cat: 'fill', rank: -1, len: 0 };
  const cat = cats[0];

  if (n === 1) return { type: 'single', cat, rank: cardRank(cards[0], sub), len: 1 };

  if (n === 2) {
    if (isPair(cards[0], cards[1])) return { type: 'pair', cat, rank: cardRank(cards[0], sub), len: 1 };
    return { type: 'fill', cat: 'fill', rank: -1, len: 0 };
  }

  if (n >= 4 && n % 2 === 0) {
    const sorted = [...cards].sort((a, b) => cardRank(a, sub) - cardRank(b, sub));
    const used = new Set();
    const pairs = [];
    for (let i = 0; i < sorted.length; i++) {
      if (used.has(i)) continue;
      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(j)) continue;
        if (isPair(sorted[i], sorted[j])) {
          pairs.push([sorted[i], sorted[j]]);
          used.add(i); used.add(j);
          break;
        }
      }
    }
    if (pairs.length === n / 2) {
      const ranks = pairs.map(p => cardRank(p[0], sub)).sort((a, b) => a - b);
      let consec = true;
      for (let i = 1; i < ranks.length; i++) if (ranks[i] - ranks[i - 1] !== 1) { consec = false; break; }
      if (consec && pairs.length >= 2) return { type: 'pair', cat, rank: ranks[0], len: pairs.length };
    }
  }

  return { type: 'fill', cat: 'fill', rank: -1, len: 0 };
}

// ━━━ 出牌比较 ━━━

function comparePlay(cardsA, idxA, cardsB, idxB, roundCat, roundType, sub) {
  const ta = getPlayType(cardsA, sub);
  const tb = getPlayType(cardsB, sub);
  const rt = roundType;

  const aMatch = ta.type !== 'fill' && ta.type === rt.type && ta.len === rt.len;
  const bMatch = tb.type !== 'fill' && tb.type === rt.type && tb.len === rt.len;
  if (aMatch && !bMatch) return 1;
  if (!aMatch && bMatch) return -1;
  if (!aMatch && !bMatch) return idxB - idxA;

  const cScore = cat => (cat === 'main' ? 2 : cat === roundCat ? 1 : 0);
  const ca = cScore(ta.cat), cb = cScore(tb.cat);
  if (ca !== cb) return ca - cb;

  if (ta.rank !== tb.rank) return ta.rank - tb.rank;

  return idxB - idxA;
}

// ━━━ 手牌排序 ━━━

function sortHand(hand, sub) {
  return [...hand].sort((a, b) => {
    const ca = cardCat(a, sub), cb = cardCat(b, sub);
    const catOrd = { main: 0, '♠': 1, '♥': 2, '♣': 3, '♦': 4 };
    const oa = catOrd[ca] ?? 5, ob = catOrd[cb] ?? 5;
    if (oa !== ob) return oa - ob;
    return cardRank(b, sub) - cardRank(a, sub);
  });
}

// ━━━ 填牌辅助 ━━━

function pickFillN(pool, n, sub) {
  const ns = [...pool].filter(c => cardScore(c) === 0)
    .sort((a, b) => cardRank(a, sub) - cardRank(b, sub));
  const sc = [...pool].filter(c => cardScore(c) > 0)
    .sort((a, b) => cardScore(a) - cardScore(b) || cardRank(a, sub) - cardRank(b, sub));
  return [...ns, ...sc].slice(0, n);
}

// ━━━ AI 决策系统 ━━━

function revBeats(k, cur) {
  return REV_ORDER.indexOf(k) > (cur ? REV_ORDER.indexOf(cur) : -1);
}

function aiPickShout(hand) {
  const tens = hand.filter(c => !c.joker && c.rank === '10');
  if (!tens.length) return null;
  const cnt = {};
  for (const c of hand)
    if (!c.joker && c.rank !== '10' && c.rank !== '2')
      cnt[c.suit] = (cnt[c.suit] || 0) + 1;
  const avail = [...new Set(tens.map(c => c.suit))];
  let best = avail[0], bc = cnt[avail[0]] || 0;
  for (const s of avail)
    if ((cnt[s] || 0) > bc) { bc = cnt[s] || 0; best = s; }
  return best;
}

function aiPickReverse(hand, curBest) {
  const checks = [
    { key: 'bigjoker', ok: h => findPairs(h.filter(c => c.joker && c.jokerType === 'big')).length > 0 },
    { key: 'smalljoker', ok: h => findPairs(h.filter(c => c.joker && c.jokerType === 'small')).length > 0 },
    { key: '♠', ok: h => findPairs(h.filter(c => !c.joker && c.rank === '10' && c.suit === '♠')).length > 0 },
    { key: '♥', ok: h => findPairs(h.filter(c => !c.joker && c.rank === '10' && c.suit === '♥')).length > 0 },
    { key: '♣', ok: h => findPairs(h.filter(c => !c.joker && c.rank === '10' && c.suit === '♣')).length > 0 },
    { key: '♦', ok: h => findPairs(h.filter(c => !c.joker && c.rank === '10' && c.suit === '♦')).length > 0 },
  ];
  for (const ch of checks)
    if (revBeats(ch.key, curBest) && ch.ok(hand)) return ch.key;
  return null;
}

function getRevPairCards(hand, key) {
  if (key === 'bigjoker') return findPairs(hand.filter(c => c.joker && c.jokerType === 'big'))[0] || null;
  if (key === 'smalljoker') return findPairs(hand.filter(c => c.joker && c.jokerType === 'small'))[0] || null;
  return findPairs(hand.filter(c => !c.joker && c.rank === '10' && c.suit === key))[0] || null;
}

function aiChoosePlay(hand, roundCat, roundType, sub, isLeader) {
  const n = roundType ? roundType.len * (roundType.type === 'single' ? 1 : 2) : 1;
  if (isLeader) return aiLead(hand, sub);
  return aiFollow(hand, roundCat, roundType, sub, n);
}

function aiLead(hand, sub) {
  const pairs = findPairs(hand).sort((a, b) => cardRank(b[0], sub) - cardRank(a[0], sub));
  if (pairs.length) return pairs[0];
  return [sortHand(hand, sub)[0]];
}

function aiFollow(hand, roundCat, roundType, sub, n) {
  const same = hand.filter(c => cardCat(c, sub) === roundCat);
  const main = hand.filter(c => cardCat(c, sub) === 'main');

  if (same.length > 0) {
    if (roundType.type === 'single') {
      return [[...same].sort((a, b) => cardRank(b, sub) - cardRank(a, sub))[0]];
    }
    if (roundType.type === 'pair' && roundType.len === 1) {
      const sp = findPairs(same).sort((a, b) => cardRank(b[0], sub) - cardRank(a[0], sub));
      if (sp.length) return sp[0];
      return pickFillN(same, 2, sub);
    }
    if (roundType.type === 'pair' && roundType.len >= 2) {
      const ss = findAllSeqs(same, roundType.len, sub);
      if (ss.length) return ss[0].play;
      const fromSame = pickFillN(same, Math.min(same.length, n), sub);
      if (fromSame.length >= n) return fromSame;
      const rest = hand.filter(c => cardCat(c, sub) !== roundCat);
      return [...fromSame, ...pickFillN(rest, n - fromSame.length, sub)];
    }
  }

  if (roundType.type === 'single') {
    if (main.length) return [[...main].sort((a, b) => cardRank(b, sub) - cardRank(a, sub))[0]];
    return pickFillN(hand, 1, sub);
  }
  if (roundType.type === 'pair') {
    if (roundType.len >= 2) {
      const ms = findAllSeqs(main, roundType.len, sub);
      if (ms.length) return ms[0].play;
    } else {
      const mp = findPairs(main).sort((a, b) => cardRank(b[0], sub) - cardRank(a[0], sub));
      if (mp.length) return mp[0];
    }
    return pickFillN(hand, n, sub);
  }
  return pickFillN(hand, n, sub);
}

// ━━━ 出牌合法性验证 ━━━

function validatePlay(cards, G) {
  if (!cards || !cards.length) return '请先选牌';
  const t = getPlayType(cards, G.sub);
  if (!t) return '无效牌型';

  if (G.isLeader) {
    if (G.mustLeadPair) {
      const pair = getRevPairCards(G.hands[0], G.mustLeadPair);
      if (pair && !pair.every(c => cards.find(x => x.uid === c.uid)))
        return '首出必须包含反牌对子';
    }
    return null;
  }

  const n = G.roundType.len * (G.roundType.type === 'single' ? 1 : 2);
  if (cards.length !== n) return `必须出${n}张`;

  const hand = G.hands[0];
  const rt = G.roundType;

  const allSameSuit = cards.every(c => cardCat(c, G.sub) === G.roundCat);

  if (!allSameSuit) {
    const remainingHand = hand.filter(c => !cards.find(x => x.uid === c.uid));
    if (remainingHand.some(c => cardCat(c, G.sub) === G.roundCat))
      return '有同花色牌，必须出同花色牌';

    const notSuit = hand.filter(c => cardCat(c, G.sub) !== G.roundCat);
    const hasNonScore = notSuit.some(c => cardScore(c) === 0);
    const fillCards = cards.filter(c => cardCat(c, G.sub) !== G.roundCat);
    if (fillCards.length > 0 && hasNonScore && fillCards.some(c => cardScore(c) > 0))
      return '有非分值牌，填牌不能出分值牌';
    return null;
  }

  if (rt.type === 'single') return null;

  if (rt.type === 'pair') {
    const sameSuitInHand = hand.filter(c => cardCat(c, G.sub) === G.roundCat);
    const allPairsInHand = findPairs(sameSuitInHand);

    if (allPairsInHand.length === 0) return null;

    const pairsNeeded = rt.len;

    if (allPairsInHand.length <= pairsNeeded) {
      const missingPair = allPairsInHand.some(p => !p.every(c => cards.find(x => x.uid === c.uid)));
      if (missingPair) return '同花色对子不足，需将所有同花色对子全部出完';
    } else {
      if (t.type !== 'pair' || t.len !== pairsNeeded)
        return `有${allPairsInHand.length}对同花色牌，必须出其中${pairsNeeded}对`;
    }

    if (pairsNeeded >= 2 && t.type === 'pair' && t.len !== pairsNeeded)
      return `需出${pairsNeeded}连对`;
    if (pairsNeeded >= 2 && t.type !== 'pair') return `需出${pairsNeeded}连对`;
  }

  const sameSuitCards = hand.filter(c => cardCat(c, G.sub) === G.roundCat);
  const nsame = sameSuitCards.filter(c => cardScore(c) === 0);
  if (nsame.length && cards.some(c => cardScore(c) > 0)) {
    const myCS = (t.cat === 'main' ? 2 : t.cat === G.roundCat ? 1 : 0);
    const beatsBest = t.type === rt.type && t.len === rt.len &&
      (myCS > G.roundBestCatScore || (myCS === G.roundBestCatScore && t.rank > G.roundBestRank));
    if (!beatsBest) return '有非分值同花色牌，不能主动填分';
  }

  return null;
}

// ━━━ 提示构建 ━━━

function buildHints(hand, G) {
  if (G.isLeader || !G.roundType) {
    const r = [];
    for (const c of hand) r.push([c]);
    for (const p of findPairs(hand)) r.push(p);
    for (let len = 2; len <= 10; len++)
      for (const s of findAllSeqs(hand, len, G.sub)) r.push(s.play);
    return r;
  }
  const n = G.roundType.len * (G.roundType.type === 'single' ? 1 : 2);
  const same = hand.filter(c => cardCat(c, G.sub) === G.roundCat);
  const res = [];
  if (G.roundType.type === 'single') {
    for (const c of same.length ? same : hand) res.push([c]);
  } else if (G.roundType.type === 'pair') {
    const pool = same.length ? same : hand;
    if (G.roundType.len === 1) {
      for (const p of findPairs(pool)) res.push(p);
    } else {
      for (const s of findAllSeqs(pool, G.roundType.len, G.sub)) res.push(s.play);
    }
    if (!res.length) res.push(pickFillN(pool.length ? pool : hand, n, G.sub));
  }
  if (!res.length) res.push(pickFillN(hand, n, G.sub));
  return res;
}

module.exports = {
  SUITS, NORMAL_RANKS, PNAME, REV_ORDER,
  makeDeck, shuffle,
  cardRank, cardCat, cardScore, totalScore,
  isPair, findPairs, findAllSeqs,
  getPlayType, comparePlay,
  sortHand, pickFillN,
  revBeats, aiPickShout, aiPickReverse, getRevPairCards,
  aiChoosePlay, aiLead, aiFollow,
  validatePlay, buildHints
};
