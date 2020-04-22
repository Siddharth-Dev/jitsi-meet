// @flow

import React, { Component } from 'react';
import {
    ScrollView,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import type { Dispatch } from 'redux';

import {
    getNearestReceiverVideoQualityLevel,
    setMaxReceiverVideoQuality
} from '../../../base/conference';
import { connect } from '../../../base/redux';
import {
    DimensionsDetector,
    isNarrowAspectRatio,
    makeAspectRatioAware
} from '../../../base/responsive-ui';

import Thumbnail from './Thumbnail';
import styles from './styles';

/**
 * The type of the React {@link Component} props of {@link TileView}.
 */
type Props = {

    /**
     * The participants in the conference.
     */
    _participants: Array<Object>,

    /**
     * Invoked to update the receiver video quality.
     */
    dispatch: Dispatch<any>,

    /**
     * Callback to invoke when tile view is tapped.
     */
    onClick: Function
};

/**
 * The type of the React {@link Component} state of {@link TileView}.
 */
type State = {

    /**
     * The available width for {@link TileView} to occupy.
     */
    height: number,

    /**
     * The available height for {@link TileView} to occupy.
     */
    width: number
};

/**
 * The margin for each side of the tile view. Taken away from the available
 * height and width for the tile container to display in.
 *
 * @private
 * @type {number}
 */
const MARGIN = 10;

/**
 * The aspect ratio the tiles should display in.
 *
 * @private
 * @type {number}
 */
const TILE_ASPECT_RATIO = 1;

/**
 * Implements a React {@link Component} which displays thumbnails in a two
 * dimensional grid.
 *
 * @extends Component
 */
class TileView extends Component<Props, State> {
    state = {
        height: 0,
        width: 0
    };

    /**
     * Initializes a new {@code TileView} instance.
     *
     * @param {Object} props - The read-only properties with which the new
     * instance is to be initialized.
     */
    constructor(props: Props) {
        super(props);

        // Bind event handler so it is only bound once per instance.
        this._onDimensionsChanged = this._onDimensionsChanged.bind(this);
    }

    /**
     * Implements React's {@link Component#componentDidMount}.
     *
     * @inheritdoc
     */
    componentDidMount() {
        this._updateReceiverQuality();
    }

    /**
     * Implements React's {@link Component#componentDidUpdate}.
     *
     * @inheritdoc
     */
    componentDidUpdate() {
        this._updateReceiverQuality();
    }

    /**
     * Implements React's {@link Component#render()}.
     *
     * @inheritdoc
     * @returns {ReactElement}
     */
    render() {
        const { onClick } = this.props;
        const { height, width } = this.state;
        const rowElements = this._groupIntoRows(
            this._renderThumbnails(), this._getColumnCount());

        return (
            <DimensionsDetector
                onDimensionsChanged = { this._onDimensionsChanged }>
                <ScrollView
                    style = {{
                        ...styles.tileView,
                        height,
                        width
                    }}>
                    <TouchableWithoutFeedback onPress = { onClick }>
                        <View
                            style = {{
                                ...styles.tileViewRows,
                                minHeight: height,
                                minWidth: width
                            }}>
                            { rowElements }
                        </View>
                    </TouchableWithoutFeedback>
                </ScrollView>
            </DimensionsDetector>
        );
    }

    /**
     * Returns how many columns should be displayed for tile view.
     *
     * @returns {number}
     * @private
     */
    _getColumnCount() {
        let participantCount = this.props._participants.length;
	participantCount = participantCount > 4 ? 4 : participantCount;

        // For narrow view, tiles should stack on top of each other for a lonely
        // call and a 1:1 call. Otherwise tiles should be grouped into rows of
        // two.
        if (isNarrowAspectRatio(this)) {
            return participantCount >= 3 ? 2 : 1;
        }

        if (participantCount === 4) {
            // In wide view, a four person call should display as a 2x2 grid.
            return 2;
        }

        return Math.min(3, participantCount);
    }

    /**
     * Returns all participants with the local participant at the end.
     *
     * @private
     * @returns {Participant[]}
     */
    _getSortedParticipants() {
        const participants = [];
        let localParticipant;
        let dominanatParticipant;

	/*const size = this.props._participants.length;
	for (let i=0;i<size;i++) {
	    let participant = this.props._participants[i];
	    if (participant.local) {
                localParticipant = participant;
            } else if (participants.length<=3) {
                participants.push(participant);
            }
	}*/
        for (const participant of this.props._participants) {
            if (participant.local) {
                localParticipant = participant;
                console.log("Local Speaker: ");
                console.log(dominanatParticipant.name);
            } else if (!participant.local && participant.dominantSpeaker) {
                dominanatParticipant = participant;
                console.log("Dominant Speaker: ");
                console.log(dominanatParticipant.name);
            }
        }
        for (const participant of this.props._participants) {
            if (!participant.local && !participant.dominantSpeaker) {
                participants.push(participant);
                if ((dominanatParticipant && participants.length == 2) || participants.length == 3) {
                    break;
                }
            }
        }

        dominanatParticipant && participants.push(dominanatParticipant);
        localParticipant && participants.push(localParticipant);

        return participants;
    }

    /**
     * Calculate the height and width for the tiles.
     *
     * @private
     * @returns {Object}
     */
    _getTileDimensions() {
        const { _participants } = this.props;
        const { height, width } = this.state;
        const columns = this._getColumnCount();
        const participantCount = _participants.length > 4 ? 4 : _participants.length;
        const heightToUse = height - (MARGIN * 2);
        const widthToUse = width - (MARGIN * 2);
        let tileWidth;

        // If there is going to be at least two rows, ensure that at least two
        // rows display fully on screen.
        if (participantCount / columns > 1) {
            tileWidth
                = Math.min(widthToUse / columns, heightToUse / 2);
        } else {
            tileWidth = Math.min(widthToUse / columns, heightToUse);
        }

        return {
            height: tileWidth / TILE_ASPECT_RATIO,
            width: tileWidth
        };
    }

    /**
     * Splits a list of thumbnails into React Elements with a maximum of
     * {@link rowLength} thumbnails in each.
     *
     * @param {Array} thumbnails - The list of thumbnails that should be split
     * into separate row groupings.
     * @param {number} rowLength - How many thumbnails should be in each row.
     * @private
     * @returns {ReactElement[]}
     */
    _groupIntoRows(thumbnails, rowLength) {
        const rowElements = [];

        for (let i = 0; i < thumbnails.length; i++) {
            if (i % rowLength === 0) {
                const thumbnailsInRow
                    = thumbnails.slice(i, i + rowLength);

                rowElements.push(
                    <View
                        key = { rowElements.length }
                        style = { styles.tileViewRow }>
                        { thumbnailsInRow }
                    </View>
                );
            }
        }

        return rowElements;
    }

    _onDimensionsChanged: (width: number, height: number) => void;

    /**
     * Updates the known available state for {@link TileView} to occupy.
     *
     * @param {number} width - The component's current width.
     * @param {number} height - The component's current height.
     * @private
     * @returns {void}
     */
    _onDimensionsChanged(width: number, height: number) {
        this.setState({
            height,
            width
        });
    }

    /**
     * Creates React Elements to display each participant in a thumbnail. Each
     * tile will be.
     *
     * @private
     * @returns {ReactElement[]}
     */
    _renderThumbnails() {
        /*const styleOverrides = {
            aspectRatio: TILE_ASPECT_RATIO,
            flex: 0,
            height: this._getTileDimensions().height,
            width: null
        };*/

       /* return this._getSortedParticipants()
            .map(participant => (
                <Thumbnail
                    disableTint = { true }
                    key = { participant.id }
                    participant = { participant }
                    renderDisplayName = { true }
                    styleOverrides = { styleOverrides }
                    tileView = { true } />));*/

	const thumbnails= [];
	const participants = this._getSortedParticipants();
	const size = participants.length;
	for (let i=0;i<size;i++) {
	    let participant = participants[i];

	let widthV = this._getTileDimensions().width;
	let heightV = this._getTileDimensions().height;
	let as = 1;
	if (size>2) {
	   const { height, width } = this.state;
           const heightToUse = height;
           const widthToUse = width;
	   if (i == 0 || i == 1 || size == 4) {
		widthV = widthToUse/2;
		heighV = heightToUse/2;	
		as = 3/6;
		
	   } else if (size == 3 && i == 2) {
		widthV = widthToUse;
		heighV = heightToUse/2;
		as = 1/1;
	   }
	}
	styleOverrides = {
            aspectRatio: as,
            flex: 0,
            height: heightV,
            width: widthV
        };

	    thumbnails.push(
		<Thumbnail
                    disableTint = { true }
                    key = { participant.id }
                    participant = { participant }
                    renderDisplayName = { true }
                    styleOverrides = { styleOverrides }
                    tileView = { true } />);
	}
	return thumbnails;
    }

    /*_getStyleOverdues(pNum: number, pSize: number) {
	let widthV = this._getTileDimensions().width;
	let heightV = this._getTileDimensions().height;
	if (pSize>2) {
	   const { height, width } = this.state;
           const heightToUse = height - (MARGIN * 2);
           const widthToUse = width - (MARGIN * 2);
	   if (pNum == 0 || pNum == 1 || pSize == 4) {
		widthV = widthToUse/2;
		heighV = heightToUse/2;
	   } else if (pSize == 3 && pNum == 2) {
		widthV = widthToUse;
		heighV = heightToUse/2;
	   }
	}
	return {
            aspectRatio: TILE_ASPECT_RATIO,
            flex: 0,
            height: heightV,
            width: widthV
        };
    }*/

    /**
     * Sets the receiver video quality based on the dimensions of the thumbnails
     * that are displayed.
     *
     * @private
     * @returns {void}
     */
    _updateReceiverQuality() {
        const { height } = this._getTileDimensions();
        const qualityLevel = getNearestReceiverVideoQualityLevel(height);

        this.props.dispatch(setMaxReceiverVideoQuality(qualityLevel));
    }
}

/**
 * Maps (parts of) the redux state to the associated {@code TileView}'s props.
 *
 * @param {Object} state - The redux state.
 * @private
 * @returns {{
 *     _participants: Participant[]
 * }}
 */
function _mapStateToProps(state) {
    return {
        _participants: state['features/base/participants']
    };
}

export default connect(_mapStateToProps)(makeAspectRatioAware(TileView));
