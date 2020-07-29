import AFRAME, { THREE } from "aframe";
import * as utils from "../modules/utils";
const log = utils.getLogger("components:meeting-audio");
import io from 'socket.io-client';
import api from '../modules/api';

AFRAME.registerComponent('meeting-audio', {
  dependencies: ['meeting'],
  peerConnectionConfig: {
    'iceServers': [
      {'urls': 'stun:stun.stunprotocol.org:3478'},
      {'urls': 'stun:stun.l.google.com:19302'},
    ]
  },

  init: function() {
    this.localStream = null;
    this.remoteAudio = document.getElementById('remoteAudio');;
    this.peerConnection = null;
    this.serverConnection = null;

    this.socket = io(api.socketUri);
    this.socketid = this.socket.id;
    console.log(this.socketid);
    this.socket.on('connect', () => {
      log.info('client audio socket connected');
    });
    this.socket.on('AudioServerMessage', this.gotMessageFromServer.bind(this));

    var constraints = {
      audio: true,
    };

    if(navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia(constraints)
        .then((stream) => {
          this.localStream = stream;
        })
        .catch(this.errorHandler);
    } else {
      alert('Your browser does not support getUserMedia API');
    }
    
    // Start call by pressing the call button
    const startButton = document.getElementById('start-call');
    startButton.addEventListener('click', this.start.bind(this));

    log.info('init done.')
  },
  start: function(isCaller=true) {
    this.peerConnection = new RTCPeerConnection(this.peerConnectionConfig);
    this.peerConnection.onicecandidate = this.gotIceCandidate.bind(this);
    this.peerConnection.ontrack = this.gotRemoteStream.bind(this);
    this.peerConnection.addStream(this.localStream);

    if(isCaller) {
      this.peerConnection.createOffer().then(this.createdDescription.bind(this)).catch(this.errorHandler);
    }
  },

  gotMessageFromServer: function(data) {
    console.log("got message");
    if (!this.peerConnection) {
      console.log('got message from server');
      this.start(false);
    }
    
    var signal = data;

    if(signal.socketid == this.socketid) return;

    console.log('message from someone else');

    if(signal.sdp) {
      this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
        // Only create answers in response to offers
        if(signal.sdp.type == 'offer') {
          console.log('recieved offer');
          this.peerConnection.createAnswer().then(this.createdDescription.bind(this)).catch(this.errorHandler);
        }
      }).catch(this.errorHandler);
    } else if (signal.ice) {
      this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(this.errorHandler);
    }
  },

  gotIceCandidate: function(event) {
    console.log('got ice candidate');
    if(event.candidate != null) {
      this.socket.emit('AudioClientMessage', {
        ice: event.candidate, 
        socketid: this.socketid
      });
    }
  },

  createdDescription: function(description) {
    console.log('got description');

    this.peerConnection.setLocalDescription(description).then(() => {
      this.socket.emit('AudioClientMessage', {
        sdp: this.peerConnection.localDescription, 
        socketid: this.socketid
      });
    }).catch(this.errorHandler);
  },

  gotRemoteStream: function(event) {
    console.log("got remote stream")
    let audioElem = document.createElement("audio");
    audioElem.srcObject = event.streams[0];
    this.el.appendChild(audioElem);
    audioElem.play();
    console.log(this.sceneEl);
    console.log(this.el);
    console.log(audioElem);
  },

  errorHandler: function(error) {
    console.log(error);
  }
});