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
    events: loadConfirmedEvents
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
          const div = document.createElement('div');
          div.className = 'proposal';
          div.innerHTML = `
            <p>${proposal.date} at ${proposal.time} (by ${proposal.proposedBy})</p>
            <p>Accepted: ${proposal.acceptedBy.join(', ')} (${proposal.acceptedBy.length}/4)</p>
            <button onclick="toggleAcceptance('${doc.id}', ${proposal.acceptedBy.includes(currentUser)})">
              ${proposal.acceptedBy.includes(currentUser) ? 'Leave' : 'Join'}
            </button>
          `;
          proposalsList.appendChild(div);
        });
      }, error => console.error("Error loading proposals:", error));
  }

  // Toggle Acceptance
  window.toggleAcceptance = function(proposalId, isAccepted) {
    const proposalRef = db.collection('proposals').doc(proposalId);
    proposalRef.get().then(doc => {
      if (!doc.exists) return;
      const acceptedBy = doc.data().acceptedBy || [];
      if (isAccepted) {
        proposalRef.update({
          acceptedBy: acceptedBy.filter(name => name !== currentUser)
        });
      } else {
        proposalRef.update({
          acceptedBy: firebase.firestore.FieldValue.arrayUnion(currentUser)
        });
      }
    }).catch(error => console.error("Toggle error:", error));
  };

  // Load Confirmed Events
  function loadConfirmedEvents(fetchInfo, successCallback) {
    db.collection('proposals')
      .get()
      .then(snapshot => {
        const events = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.acceptedBy && data.acceptedBy.length >= 4) {
            events.push({
              title: `Badminton Meet (${data.acceptedBy.length})`,
              start: `${data.date}T${data.time}`,
              allDay: false
            });
          }
        });
        successCallback(events);
      })
      .catch(error => {
        console.error("Error loading calendar events:", error);
        successCallback([]);
      });
  }
});
