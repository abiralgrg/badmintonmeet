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

  // Calendar Setup with enhanced configuration
  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    events: loadAllEvents,
    eventContent: function(arg) {
      // Create custom content with just a symbol
      const eventSymbol = document.createElement('div');
      eventSymbol.classList.add('event-symbol');
      
      if (arg.event.extendedProps.status === 'confirmed') {
        eventSymbol.innerHTML = '✓'; // Tick mark for confirmed
        eventSymbol.classList.add('confirmed-symbol');
      } else {
        eventSymbol.innerHTML = '○'; // Circle for proposed
        eventSymbol.classList.add('proposed-symbol');
      }
      
      const wrapper = document.createElement('div');
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
      wrapper.style.position = 'relative';
      wrapper.appendChild(eventSymbol);
      
      return { domNodes: [wrapper] };
    },
    eventDidMount: function(info) {
      // Add tooltip with participants and info
      const participantsText = info.event.extendedProps.participants.join(', ');
      const count = info.event.extendedProps.participants.length;
      const status = info.event.extendedProps.status === 'confirmed' ? 'Confirmed' : 'Proposed';
      
      info.el.title = `${status} Badminton (${count}/4)\nParticipants: ${participantsText}`;
      
      // Make parent take full width of the day cell
      const harness = info.el.closest('.fc-daygrid-event-harness');
      if (harness) {
        harness.style.width = '100%';
        harness.style.margin = '0';
      }
    },
    height: 'auto',
    // Remove time text from events
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
      // Refresh calendar to show the new proposal
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
          
          // Ensure acceptedBy is an array - this is the key fix
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
        
        // Refresh calendar when proposals change
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
      
      // Refresh calendar when proposal is updated
      calendar.refetchEvents();
    }).catch(error => console.error("Toggle error:", error));
  };

  // Load All Events (both proposed and confirmed)
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
            title: '', // Empty title - we'll use custom rendering
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
