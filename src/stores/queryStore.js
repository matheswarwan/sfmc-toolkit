import { createStore } from 'vuex';

export default createStore({
  state: {
    searchText: ''
  },
  mutations: {
    setSearchText(state, text) {
      state.searchText = text;
    }
  },
  actions: {
    updateSearchText({ commit }, text) {
      commit('setSearchText', text);
    }
  }
});
