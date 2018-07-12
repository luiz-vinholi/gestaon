import _ from 'lodash';

export const setApp = (state, app) => {
    state.app = _.assign({}, state.app, app);
};

export const setAppTitle = (state, appTitle) => {
  state.app.title = appTitle;
};

export const setSystemInitialized = (state, initialized) => {
    state.system.initialized = initialized;
};

export const setMainContentArea = (state, mainContentArea) => {
    state.mainContentArea = mainContentArea;
};

export const SET_APP_VERSION = (state, version) => {
    state.app.version = version
};

export const SET_WINDOW_DIMENSIONS = (state, { width = 0, height = 0 }) => {
    state.dimensions.window.width = width
    state.dimensions.window.height = height
};