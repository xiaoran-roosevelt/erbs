Component({
  properties: {
    card: { type: Object, value: null },
    faceUp: { type: Boolean, value: true },
    selected: { type: Boolean, value: false },
    hintHighlight: { type: Boolean, value: false },
    size: { type: String, value: 'large' },
    orientation: { type: String, value: 'portrait' }
  },

  data: {
    colorClass: '',
    suitDisplay: '',
    rankUpper: '',
    rankLower: '',
    isRed: false
  },

  observers: {
    'card'(c) {
      if (!c) return;
      const isRed = c.joker || c.suit === '♥' || c.suit === '♦';
      this.setData({
        colorClass: isRed ? 'cred' : 'cblk',
        suitDisplay: c.suit || '',
        rankUpper: c.rank || '',
        rankLower: c.rank || '',
        isRed
      });
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { card: this.properties.card });
    }
  }
});
