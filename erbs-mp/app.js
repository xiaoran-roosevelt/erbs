App({
  globalData: {
    cumScores: [0, 0, 0, 0],
    roundNum: 0,
    highScore: 0
  },

  onLaunch() {
    wx.setInnerAudioOption && wx.setInnerAudioOption({ obeyMuteSwitch: false });
  }
});
