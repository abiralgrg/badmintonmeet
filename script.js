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
let calendar = null;
const WEBHOOK_URL = "https://discord.com/api/webhooks/1350865378275754084/2zmhPDKsvH_NsvvBQbJ7MzVTHqlHBRejW-ujKIhdeTHlFGiWIYq6pgNtVT_8nEjMm9WG"; // Replace with your Discord webhook URL
let notifiedProposals = new Set(); // Track which proposals have already sent notifications
let notifiedNewProposals = new Set(); // Track new proposals that have sent notifications

document.addEventListener('DOMContentLoaded', function() {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  // Calendar Setup with text labels
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    events: loadAllEvents,
    headerToolbar: {
      left: 'title',
      center: '',
      right: 'prev,next'
    },
    eventContent: function(arg) {
      const eventContainer = document.createElement('div');
      eventContainer.classList.add('event-container');
      
      const timeText = formatTime(arg.event.start);
      
      if (arg.event.extendedProps.status === 'confirmed') {
        eventContainer.innerHTML = `<div class="event-text confirmed">Badminton Meet @ ${timeText}</div>`;
      } else {
        eventContainer.innerHTML = `<div class="event-text proposed">Proposed: ${timeText}</div>`;
      }
      
      return { domNodes: [eventContainer] };
    },
    eventDidMount: function(info) {
      const participantsText = info.event.extendedProps.participants.join(', ');
      const count = info.event.extendedProps.participants.length;
      const status = info.event.extendedProps.status === 'confirmed' ? 'Confirmed' : 'Proposed';
      info.el.title = `${status} Badminton (${count}/4)\nParticipants: ${participantsText}`;
    },
    height: '100%',
    displayEventTime: false
  });
  calendar.render();
  
  // Format time from date object
  function formatTime(dateObj) {
    if (!dateObj) return '';
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${hours}:${minutes} ${ampm}`;
  }
  
  // Format date for display
  function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  }
  
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
    
    // Create proposal in Firestore
    db.collection('proposals').add({
      date: date,
      time: time,
      proposedBy: currentUser,
      acceptedBy: [currentUser],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      notified: false, // Track if confirmation notification was sent
      proposalNotified: false // Track if proposal notification was sent
    }).then((docRef) => {
      const proposalId = docRef.id;
      const proposalData = {
        date: date,
        time: time,
        proposedBy: currentUser,
        acceptedBy: [currentUser],
        id: proposalId
      };
      
      // Send Discord notification for new proposal
      if (!notifiedNewProposals.has(proposalId)) {
        sendProposalNotification(proposalData);
        notifiedNewProposals.add(proposalId);
        
        // Update the proposal to mark it as notified
        db.collection('proposals').doc(proposalId).update({
          proposalNotified: true
        });
      }
      
      // Clear form and refresh
      loadProposals();
      document.getElementById('propose-date').value = '';
      document.getElementById('propose-time').value = '';
      calendar.refetchEvents();
    }).catch(error => console.error("Propose error:", error));
  };

  // Load Proposals and check for notifications
  function loadProposals() {
    const proposalsList = document.getElementById('proposals-list');
    proposalsList.innerHTML = 'Loading proposals...';
    db.collection('proposals')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        proposalsList.innerHTML = '';
        snapshot.forEach(doc => {
          const proposal = doc.data();
          const proposalId = doc.id;
          const acceptedBy = Array.isArray(proposal.acceptedBy) ? proposal.acceptedBy : [];
          const acceptedCount = acceptedBy.length;
          const isProposer = proposal.proposedBy === currentUser;
          const isConfirmed = acceptedCount >= 4;
          
          // Check if this is newly confirmed and needs notification
          if (isConfirmed && !proposal.notified && !notifiedProposals.has(proposalId)) {
            sendConfirmationNotification(proposal, proposalId);
            notifiedProposals.add(proposalId);
          }
          
          const div = document.createElement('div');
          div.className = `proposal ${isConfirmed ? 'confirmed' : ''}`;
          div.innerHTML = `
            <p>${proposal.date} at ${proposal.time} (by ${proposal.proposedBy})</p>
            <p>Accepted: ${acceptedBy.join(', ')} (${acceptedCount}/4)</p>
            <div class="proposal-actions">
              <button onclick="toggleAcceptance('${proposalId}', ${acceptedBy.includes(currentUser)})">
                ${acceptedBy.includes(currentUser) ? 'Leave' : 'Join'}
              </button>
              ${isProposer ? `<button class="delete-button" onclick="deleteProposal('${proposalId}')">Delete</button>` : ''}
            </div>
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
      let proposal = doc.data();
      let acceptedBy = proposal.acceptedBy || [];
      if (!Array.isArray(acceptedBy)) acceptedBy = [];
      
      let updatedAcceptedBy;
      if (isAccepted) {
        updatedAcceptedBy = acceptedBy.filter(name => name !== currentUser);
      } else {
        updatedAcceptedBy = [...acceptedBy, currentUser];
      }
      
      proposalRef.update({
        acceptedBy: updatedAcceptedBy
      }).then(() => {
        // Check if this action confirmed the meetup
        if (updatedAcceptedBy.length >= 4 && !proposal.notified && !notifiedProposals.has(proposalId)) {
          proposalRef.get().then(updatedDoc => {
            const updatedProposal = updatedDoc.data();
            sendConfirmationNotification(updatedProposal, proposalId);
            notifiedProposals.add(proposalId);
          });
        }
        calendar.refetchEvents();
      });
    }).catch(error => console.error("Toggle error:", error));
  };

  // Send Discord Notification for a new proposal
  function sendProposalNotification(proposal) {
    // Format date and time for better readability
    const formattedDate = formatDate(proposal.date);
    const timeStr = proposal.time;
    
    // Create rich embed for Discord webhook
    const webhookData = {
      content: "New badminton meet proposal!",
      embeds: [{
        title: "New Badminton Meet Proposal",
        color: 3447003, // Blue color
        fields: [
          {
            name: "Date",
            value: formattedDate,
            inline: true
          },
          {
            name: "Time",
            value: timeStr,
            inline: true
          },
          {
            name: "Proposed By",
            value: proposal.proposedBy,
            inline: true
          },
          {
            name: "Participants",
            value: proposal.acceptedBy.join(", ") + ` (${proposal.acceptedBy.length}/4)`,
            inline: false
          }
        ],
        footer: {
          text: "Join the meetup in the Badminton Meet app!"
        }
      }]
    };
    
    // Send the notification to Discord webhook
    fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(webhookData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Discord webhook error: ${response.status}`);
      }
      console.log("Discord proposal notification sent successfully!");
    })
    .catch(error => console.error("Error sending Discord notification:", error));
  }

  // Send Discord Notification for confirmed meetup
  function sendConfirmationNotification(proposal, proposalId) {
    // Mark as notified in Firebase first
    const proposalRef = db.collection('proposals').doc(proposalId);
    proposalRef.update({ notified: true });
    
    // Format date and time for better readability
    const formattedDate = formatDate(proposal.date);
    const timeStr = proposal.time;
    
    // Create rich embed for Discord webhook
    const webhookData = {
      content: "@everyone A badminton meet has been confirmed! :badminton:",
      embeds: [{
        title: "Badminton Meet Confirmed!",
        color: 5025616, // Green color
        fields: [
          {
            name: "Date",
            value: formattedDate,
            inline: true
          },
          {
            name: "Time",
            value: timeStr,
            inline: true
          },
          {
            name: "Proposed By",
            value: proposal.proposedBy,
            inline: true
          },
          {
            name: "Participants",
            value: proposal.acceptedBy.join(", "),
            inline: false
          }
        ],
        footer: {
          text: "See you on the court!"
        }
      }]
    };
    
    // Send the notification to Discord webhook
    fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(webhookData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Discord webhook error: ${response.status}`);
      }
      console.log("Discord confirmation notification sent successfully!");
    })
    .catch(error => console.error("Error sending Discord notification:", error));
  }

  // Delete Proposal
  window.deleteProposal = function(proposalId) {
    if (!currentUser) return;
    
    const proposalRef = db.collection('proposals').doc(proposalId);
    proposalRef.get().then(doc => {
      if (!doc.exists) return;
      
      const data = doc.data();
      // Only allow deletion if current user is the proposer
      if (data.proposedBy === currentUser) {
        proposalRef.delete().then(() => {
          console.log("Proposal successfully deleted!");
          calendar.refetchEvents();
        }).catch(error => {
          console.error("Error deleting proposal:", error);
        });
      } else {
        console.error("You don't have permission to delete this proposal");
      }
    }).catch(error => {
      console.error("Error checking proposal:", error);
    });
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
            start: `${data.date}T${data.time}`,
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

// Toggle between calendar and chat views
window.toggleView = function(viewName) {
  const calendarContainer = document.getElementById('calendar-container');
  const chatContainer = document.getElementById('chat-container');
  const calendarToggle = document.getElementById('calendar-toggle');
  const chatToggle = document.getElementById('chat-toggle');
  
  if (viewName === 'calendar') {
    calendarContainer.style.display = 'flex';
    chatContainer.style.display = 'none';
    calendarToggle.classList.add('active');
    chatToggle.classList.remove('active');
    if (calendar) {
      calendar.updateSize();
    }
  } else {
    calendarContainer.style.display = 'none';
    chatContainer.style.display = 'flex';
    calendarToggle.classList.remove('active');
    chatToggle.classList.add('active');
  }
};
