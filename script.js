// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBETUme1XqagHowwggApN53A2aINQcAiM8",
  authDomain: "badminton-meet.firebaseapp.com",
  projectId: "badminton-meet",
  storageBucket: "badminton-meet.firebasestorage.app",
  messagingSenderId: "662574308710",
  appId: "1:662574308710:web:b321b63596c2770b247ca7",
  measurementId: "G-2NCW3MYNWN"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null;

// Setup Calendar
document.addEventListener('DOMContentLoaded', function() {
  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    events: loadAllEvents,
    eventContent: function(arg) {
      return { domNodes: [document.createTextNode(arg.event.title)] };
    },
    height: 'auto',
    displayEventTime: false
  });
  calendar.render();

  // Login function
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

  // Propose a meetup
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
          const acceptedBy = proposal.acceptedBy || [];
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
      });
  }

  // Load Events
  function loadAllEvents(fetchInfo, successCallback) {
    db.collection('proposals').get().then(snapshot => {
      const events = snapshot.docs.map(doc => ({
        title: doc.data().date,
        start: doc.data().date,
      }));
      successCallback(events);
    });
  }
});
