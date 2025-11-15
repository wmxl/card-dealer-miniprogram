// components/rules-modal/rules-modal.js
const { GAME_RULES } = require('../../utils/game-rules.js')

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },

  data: {
    rules: GAME_RULES
  },

  methods: {
    close() {
      this.triggerEvent('close')
    },

    // 阻止滚动穿透
    preventScroll() {
      return false
    }
  }
})
