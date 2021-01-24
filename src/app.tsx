import React from 'react';
import ReactDOM from 'react-dom';
import AppContainer from './containers/app.container';

import './styles/global.scss';

const App = () => {
    return <AppContainer />;
};

// Render to index.html
ReactDOM.render(<App />, document.getElementById('root'));
