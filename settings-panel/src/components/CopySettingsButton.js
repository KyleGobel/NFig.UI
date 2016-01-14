import React, { Component, PropTypes } from 'react';
import Portal from 'react-portal';
import Modal from './Modal';
import ButtonGroup from './ButtonGroup';
import RadioButton from './RadioButton';
import pick from 'lodash/pick';

import { connect } from 'react-redux';
import { actions } from '../store';

import request from 'superagent';

import arrowPng from '../assets/arrow.png';

import { render as markdown } from '../marked-renderer';

function md(str) {
    return markdown(str, {
        paragraph: str => str // don't bother with paragraphs
    });
}


class CopySettingsButton extends Component {

    static propTypes = {
        className              : PropTypes.string.isRequired,

        host                   : PropTypes.string,
        copyFrom               : PropTypes.bool,
        showConfirm            : PropTypes.bool,
        currentRedisConnection : PropTypes.string,
        message                : PropTypes.string,
        error                  : PropTypes.string
    };

    static defaultState = {
        showModal: false
    };

    constructor(props) {
        super(props);
        this.state = CopySettingsButton.defaultState;
    }

    handleClose() {
        this.setState(CopySettingsButton.defaultState);
        this.props.dispatch(actions.setCopyHost(''));
        this.props.dispatch(actions.setCopyDirection(false));
        this.props.dispatch(actions.clearMessage());
    }

    handleHostChange(host) {
        this.props.dispatch(actions.setCopyHost(host));
    }

    handleDirectionChange(copyFrom) {
        this.props.dispatch(actions.setCopyDirection(copyFrom));
    }

    showConfirm(show) {
        this.setState({showConfirm: show});
    }

    handleCopySettings() {
        this.props.dispatch(actions.confirmCopy());
        this.props.dispatch(actions.setCopyHost(''));
        this.showConfirm(false);
    }

    render() {
        const {
            showModal,
            showConfirm
        } = this.state;

        const {
            className,
            currentRedisConnection,
            host: redisHost = '',
            copyFrom = false,
            error,
            message
        } = this.props;

        return (
            <span className="copy-settings">
                <button onClick={() => this.setState({showModal: true})}>Copy Settings</button>

                <Portal isOpened={showModal} className="copy-settings-modal">
                    <CopySettingsModal {...{ className, currentRedisConnection, redisHost, copyFrom, message, error }}
                        onRequestClose={() => this.handleClose()}
                        onHostChange={e => this.handleHostChange(e.target.value)}
                        onDirectionChange={copyFrom => this.handleDirectionChange(copyFrom)}
                        onCopyClick={() => this.showConfirm(true)}
                    />
                </Portal>

                <Portal isOpened={showConfirm} className="copy-settings-modal confirm">
                    <CopySettingsConfirm {...{ className, currentRedisConnection, redisHost, copyFrom }}
                        onRequestClose={() => this.setState({showConfirm: false})}
                        onConfirm={() => this.handleCopySettings()}
                    />
                </Portal>
            </span>
        );
    }
};

const extractPort = str => str.replace(/^.+:(\d{1,5})$/, '$1');

class CopySettingsConfirm extends Component {


    static propTypes = {
        className              : PropTypes.string.isRequired,
        currentRedisConnection : PropTypes.string.isRequired,
        redisHost              : PropTypes.string.isRequired,
        copyFrom               : PropTypes.bool.isRequired,
        onRequestClose         : PropTypes.func.isRequired,
        onConfirm              : PropTypes.func.isRequired
    };

    areSamePorts(redis1, redis2) {

        return extractPort(redis1) === extractPort(redis2);
    }

    render() {

        const { 
            onRequestClose,
            className,
            currentRedisConnection,
            redisHost,
            copyFrom,
            onConfirm
        } = this.props;

        const src = copyFrom ? redisHost : currentRedisConnection;
        const dst = copyFrom ? currentRedisConnection : redisHost;

        const samePorts = this.areSamePorts(src, dst);

        return (
            <Modal className={className} onRequestClose={onRequestClose}>
                <div className={`${className}-header`}>
                    <button type="button" className="close" onClick={onRequestClose}>
                        <span aria-hidden="true">&times;</span>
                        <span className="sr-only">Close</span>
                    </button>
                    <h2>Are you sure?</h2>
                </div>
                <div className={`${className}-body`}>
                    <p dangerouslySetInnerHTML={{__html:
                        md(`**\`${dst}\` will have all of its setting overrides completely replaced** by
                           the overrides from **\`${src}\`**.  
                           _**This action cannot be undone**_`)
                        }} 
                    />
                    <div 
                        display-if={!samePorts} 
                        className="settings-panel-error"
                        dangerouslySetInnerHTML={{__html: 
                            md(`**\*Warning\***: The port numbers you have specified do not match.`) 
                        }}
                    />
                </div>
                <div className={`${className}-footer`}>
                    <span className="dlg-cta">
                        <button
                            className="submit label-button"
                            onClick={onConfirm}
                            >
                            Confirm
                        </button>
                    </span>
                </div>
            </Modal>
        );
    }
}


// Functions for ip address / host name checks
const isHostName = str =>  /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/.test(str);
const isIpAddress = str => /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/.test(str);
const isPortNumber = str => /^0*(?:6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[1-9][0-9]{1,3}|[0-9])$/.test(str);

class CopySettingsModal extends Component {
    static propTypes = {
        className              : PropTypes.string.isRequired,
        currentRedisConnection : PropTypes.string.isRequired,

        redisHost              : PropTypes.string.isRequired,
        copyFrom               : PropTypes.bool.isRequired,

        onRequestClose         : PropTypes.func.isRequired,
        onHostChange           : PropTypes.func.isRequired,
        onDirectionChange      : PropTypes.func.isRequired,
        onCopyClick            : PropTypes.func.isRequired,

        message                : PropTypes.string,
        error                  : PropTypes.string
    };

    canConfirm() {
        const { redisHost, currentRedisConnection } = this.props;

        if (redisHost.trim() === '')
            return false;

        if (redisHost.trim() === currentRedisConnection.trim())
            return false;

        if (redisHost.indexOf(':') !== -1) {
            const parts = redisHost.split(':');
            if (parts.length > 2) 
                return false;

            const isHost = isHostName(parts[0]);
            const isPort = isPortNumber(parts[1]);

            return isHost && isPort;
        }

        return isHostName(redisHost) || isIpAddress(redisHost);
    }

    render() {

        const {
            className,
            currentRedisConnection,
            redisHost,
            copyFrom,

            error,
            message,

            onRequestClose,
            onHostChange,
            onDirectionChange,
            onCopyClick
        } = this.props;

        

        return (
            <Modal className={className} onRequestClose={onRequestClose}>

                <div className={`${className}-header`}>
                    <button type="button" className="close" onClick={onRequestClose}>
                        <span aria-hidden="true">&times;</span>
                        <span className="sr-only">Close</span>
                    </button>
                    <h2>Copy all settings</h2>
                </div>

                <div className={`${className}-body`} display-if={error || message}>
                    <p className={error ? 'settings-panel-error' : 'settings-panel-success'}>
                        {error || message}
                    </p>
                </div>
                <div className={`${className}-body`}>
                    <p>
                        Current connection: <strong><code>{currentRedisConnection}</code></strong>
                    </p>
                    <p>
                        <input
                            type="text"
                            placeholder="Enter a redis instance (host:port)"
                            value={redisHost}
                            onChange={onHostChange}
                        />
                    </p>
                </div>
                <div className={`${className}-footer`}>
                    <ButtonGroup name="direction" onChange={onDirectionChange} selectedValue={copyFrom}>
                        <RadioButton value={false}>Copy To</RadioButton>
                        <RadioButton value={true}>Copy From</RadioButton>
                    </ButtonGroup>
                    <span className="dlg-cta">
                        <button
                            className="submit label-button"
                            disabled={!this.canConfirm()}
                            onClick={onCopyClick}
                        >
                            Copy Settings
                        </button>
                    </span>
                </div>

            </Modal>
        );
    }
}

function mapStateToProps({ copySettings }) {
    return {...copySettings};
}

export default connect(mapStateToProps)(CopySettingsButton);
