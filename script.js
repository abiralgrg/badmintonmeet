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

  // Calendar Setup
  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    events: loadAllEvents,
    // IMPORTANT: Use custom rendering to show only symbols
    eventContent: function(arg) {
      const symbolEl = document.createElement('div');
      symbolEl.className = 'event-symbol';
      
      if (arg.event.extendedProps.status === 'confirmed') {
        symbolEl.innerHTML = '✓';
        symbolEl.className += ' confirmed-symbol';
      } else {
        symbolEl.innerHTML = '○';
        symbolEl.className += ' proposed-symbol';
      }
      
      // Return ONLY the symbol element with no title text
      return { domNodes: [symbolEl] };
    },
    eventDidMount: function(info) {
      // Add tooltip with participants and info
      const participantsText = info.event.extendedProps.participants.join(', ');
      const count = info.event.extendedProps.participants.length;
      const status = info.event.extendedProps.status === 'confirmed' ? 'Confirmed' : 'Proposed';
      
      info.el.title = `${status} Badminton (${count}/4)\nParticipants: ${participantsText}`;
    }
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
          
          // Ensure acceptedBy is an array
          const acceptedBy = Array.isArray(proposal.acceptedBy) ? proposal.acceptedBy : [];
          const acceptedCount = acceptedBy.length;
          
          const div = document.createElement('div');
          div.className = 'proposal';
          div.innerHTML = `
            <p>${proposal.date} at ${proposal.time} (by ${proposal.proposedBy})</p>
            <p>Accepted: ${acceptedBy.join(', ')} (${acceptedCount}/4)</p>
            <button onclick="toggleAcceptance('${doc.id}', ${acceptedBy.includes(currentUser)})">
              ${acceptedBy.includes(currentUser) ? 'Leave' : 'Join'}
            </button>
          `;
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
      
      // Ensure acceptedBy is an array
      if (!Array.isArray(acceptedBy)) {
        acceptedBy = [];
      }
      
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

  // Load All Events - SUPER CLEAN, NO TEXT
  function loadAllEvents(fetchInfo, successCallback) {
    db.collection('proposals')
      .get()
      .then(snapshot => {
        const events = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          // Ensure acceptedBy is an array
          const acceptedBy = Array.isArray(data.acceptedBy) ? data.acceptedBy : [];
          const isConfirmed = acceptedBy.length >= 4;
          
          events.push({
            // Important: Leave title empty - we'll use custom rendering with no text
            title: '',
            start: `${data.date}T${data.time}`,
            allDay: false,
            className: isConfirmed ? 'event-confirmed' : 'event-proposed',
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
