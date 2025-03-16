// Firebase Config (replace with your actual config from Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyBETUme1XqagHowwggApN53A2aINQcAiM8",
  authDomain: "badminton-meet.firebaseapp.com",
  projectId: "badminton-meet",
  storageBucket: "badminton-meet.firebasestorage.app",
  messagingSenderId: "662574308710",
  appId: "1:662574308710:web:b321b63596c2770b247ca7",
  measurementId: "G-2NCW3MYNWN"
};

// Global Variables
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  // Calendar Setup with bold centered symbols
  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    events: loadAllEvents,
    eventContent: function(arg) {
      const symbol = document.createElement('span');
      symbol.classList.add('event-symbol');
      symbol.innerHTML = arg.event.extendedProps.status === 'confirmed' ? '✓' : '○';
      return { domNodes: [symbol] };
    },
    eventDidMount: function(info) {
      const participantsText = info.event.extendedProps.participants.join(', ');
      const count = info.event.extendedProps.participants.length;
      const status = info.event.extendedProps.status === 'confirmed' ? 'Confirmed' : 'Proposed';
      info.el.title = ${status} Badminton (${count}/4)\nParticipants: ${participantsText};
    },
    height: 'auto',
    displayEventTime: false
  });
  calendar.render();

  // Login
  window.login = function() {
    const name = document.getElementById('user-name').value.trim();
    if (name) {
      currentUser = name;
      document.getElementById('login-section').style.display = 'none';
      document.getElementById('propose-section').style.display = 'block';
      loadProposals();
    } else {
      alert('Please enter your name!');
    }
  };

  // Propose Meetup
  window.proposeMeetup = function() {
    const date = document.getElementById('propose-date').value;
    const time = document.getElementById('propose-time').value;
    if (!date || !time || !currentUser) return;
    db.collection('proposals').add({
      date: date,
      time: time,
      proposedBy: currentUser,
      acceptedBy: [currentUser],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      loadProposals();
      document.getElementById('propose-date').value = '';
      document.getElementById('propose-time').value = '';
      calendar.refetchEvents();
    }).catch(error => console.error("Propose error:", error));
  };

  // Load Proposals
  function loadProposals() {
    const proposalsList = document.getElementById('proposals-list');
    proposalsList.innerHTML = 'Loading proposals...';
    db.collection('proposals')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        proposalsList.innerHTML = '';
        snapshot.forEach(doc => {
          const proposal = doc.data();
          const acceptedBy = Array.isArray(proposal.acceptedBy) ? proposal.acceptedBy : [];
          const acceptedCount = acceptedBy.length;
          
          const div = document.createElement('div');
          div.className = 'proposal';
          div.innerHTML = 
            <p>${proposal.date} at ${proposal.time} (by ${proposal.proposedBy})</p>
            <p>Accepted: ${acceptedBy.join(', ')} (${acceptedCount}/4)</p>
            <button onclick="toggleAcceptance('${doc.id}', ${acceptedBy.includes(currentUser)})">
              ${acceptedBy.includes(currentUser) ? 'Leave' : 'Join'}
            </button>
          ;
          proposalsList.appendChild(div);
        });
        calendar.refetchEvents();
      }, error => console.error("Error loading proposals:", error));
  }

  // Toggle Acceptance
  window.toggleAcceptance = function(proposalId, isAccepted) {
    const proposalRef = db.collection('proposals').doc(proposalId);
    proposalRef.get().then(doc => {
      if (!doc.exists) return;
      let acceptedBy = doc.data().acceptedBy || [];
      if (!Array.isArray(acceptedBy)) acceptedBy = [];
      
      if (isAccepted) {
        proposalRef.update({
          acceptedBy: acceptedBy.filter(name => name !== currentUser)
        });
      } else {
        proposalRef.update({
          acceptedBy: firebase.firestore.FieldValue.arrayUnion(currentUser)
        });
      }
      calendar.refetchEvents();
    }).catch(error => console.error("Toggle error:", error));
  };

  // Load All Events
  function loadAllEvents(fetchInfo, successCallback) {
    db.collection('proposals')
      .get()
      .then(snapshot => {
        const events = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          const acceptedBy = Array.isArray(data.acceptedBy) ? data.acceptedBy : [];
          const isConfirmed = acceptedBy.length >= 4;
          
          events.push({
            title: '', // Empty title
            start: ${data.date}T${data.time},
            allDay: false,
            extendedProps: {
              status: isConfirmed ? 'confirmed' : 'proposed',
              participants: acceptedBy
            }
          });
        });
        successCallback(events);
      })
      .catch(error => {
        console.error("Error loading calendar events:", error);
        successCallback([]);
      });
  }
});
