import React, {Component} from 'react';

const LinkInput = (props) => {
    const [state, setState] = React.useState({inputValue: '', showError: false});

    const getIdFromUrl = (url) => {
        let id = '';
        let regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        let match = url.match(regExp);

        if (match && match[2].length == 11) {
            return match[2];
        } else {
            return null;
        }
    };

    const updateInputValue = (e) => {
        setState({
            inputValue: e.target.value,
            showError: false
        });
    };

    const startDownload = () => {
        let id = getIdFromUrl(state.inputValue);
        if (id === null) {
            setState({
                ...state,
                showError: true
            });
        } else {
            props.startDownload(id);
        }
    };

    let className = `link__input${state.showError ? '--error' : ''}`;
    return (
        <div>
            <input
                className={className}
                onChange={updateInputValue}
                placeholder="https://www.youtube.com/watch?v=zmXUWKwxDg4"
            />
            <div className="center">
                <button className="link__button" onClick={() => startDownload()}>
                    Convert to .mp3
                </button>
            </div>
        </div>
    );
};

export default LinkInput;
