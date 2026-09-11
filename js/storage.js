/* storage.js — сохранение прогресса и последних ответов в localStorage */
var Storage = {
  KEY_PROGRESS: 'mt.progress',
  KEY_ANSWERS: 'mt.answers',

  getProgress: function () {
    try {
      var p = JSON.parse(localStorage.getItem(this.KEY_PROGRESS));
      return p && typeof p === 'object' ? p : {};
    } catch (e) { return {}; }
  },
  _write: function (key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
      return true;
    } catch (e) {
      return false;
    }
  },
  setState: function (taskId, patch) {
    var p = this.getProgress();
    p[taskId] = Object.assign({}, p[taskId] || {}, patch);
    this._write(this.KEY_PROGRESS, p);
  },
  setSolved: function (taskId, solved) { this.setState(taskId, { solved: !!solved }); },
  setHinted: function (taskId, hinted) { this.setState(taskId, { hinted: !!hinted }); },
  getState: function (taskId) { return this.getProgress()[taskId] || {}; },
  isSolved: function (taskId) { return !!this.getState(taskId).solved; },
  isHinted: function (taskId) { return !!this.getState(taskId).hinted; },

  getAnswers: function () {
    try {
      var d = JSON.parse(localStorage.getItem(this.KEY_ANSWERS));
      return d && typeof d === 'object' ? d : {};
    } catch (e) { return {}; }
  },
  getAnswer: function (taskId) { return this.getAnswers()[taskId]; },
  setAnswer: function (taskId, value) {
    var d = this.getAnswers();
    d[taskId] = value;
    this._write(this.KEY_ANSWERS, d);
  },

  resetAll: function () {
    localStorage.removeItem(this.KEY_PROGRESS);
    localStorage.removeItem(this.KEY_ANSWERS);
  }
};