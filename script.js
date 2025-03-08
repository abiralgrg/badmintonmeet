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

  // Calendar Setup with minimalist symbols
  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    dayCellContent: function(arg) {
      // Fetch proposals for this date dynamically
      const dateStr = arg.date.toISOString().split('T')[0]; // YYYY-MM-DD
      const symbolContainer = document.createElement('div');
      symbolContainer.classList.add('day-symbol-container');

      db.collection('proposals')
        .where('date', '==', dateStr)
        .get()
        .then(snapshot => {
          let hasProposed = false;
          let hasConfirmed = false;
          snapshot.forEach(doc => {
            const data = doc.data();
            const acceptedBy = Array.isArray(data.acceptedBy) ? data.acceptedBy : [];
            if (acceptedBy.length >= 4) {
              hasConfirmed = true;
            } else {
              hasProposed = true;
            }
          });

          if (hasConfirmed) {
            const confirmedSymbol = document.createElement('span');
            confirmedSymbol.innerHTML = '✓';
            confirmedSymbol.classList.add('confirmed-symbol');
            symbolContainer.appendChild(confirmedSymbol);
          } else if (hasProposed) {
            const proposedSymbol = document.createElement('span');
            proposedSymbol.innerHTML = '○';
            proposedSymbol.classList.add('proposed-symbol');
            symbolContainer.appendChild(proposedSymbol);
          }
        });

      return { domNodes: [symbolContainer] };
    },
    dayCellDidMount: function(arg) {
      // Add tooltip with details
      const dateStr = arg.date.toISOString().split('T')[0];
      db.collection('proposals')
        .where('date', '==', dateStr)
        .get()
        .then(snapshot => {
          let tooltipText = '';
          snapshot.forEach(doc => {
            const data = doc.data();
            const acceptedBy = Array.isArray(data.acceptedBy) ? data.acceptedBy : [];
            const status = acceptedBy.length >= 4 ? 'Confirmed' : 'Proposed';
            const participantsText = acceptedBy.join(', ');
            tooltipText += `${status} Badminton (${acceptedBy.length}/4) at ${data.time}\nParticipants: ${participantsText}\n`;
          });
          if (tooltipText) {
            arg.el.title = tooltipText.trim();
          }
        });
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
      calendar.render(); // Re-render calendar to update symbols
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
          div.innerHTML = `
            <p>${proposal.date} at ${proposal.time} (by ${proposal.proposedBy})</p>
            <p>Accepted: ${acceptedBy.join(', ')} (${acceptedCount}/4)</p>
            <button onclick="toggleAcceptance('${doc.id}', ${acceptedBy.includes(currentUser)})">
              ${acceptedBy.includes(currentUser) ? 'Leave' : 'Join'}
            </button>
          `;
          proposalsList.appendChild(div);
        });
        calendar.render(); // Re-render calendar when proposals change
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
      calendar.render(); // Re-render calendar when updated
    }).catch(error => console.error("Toggle error:", error));
  };
});
