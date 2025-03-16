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
const WEBHOOK_URL = "YOUR_DISCORD_WEBHOOK_URL"; // Replace with your Discord webhook URL
let notifiedProposals = new Set(); // Track which proposals have already sent notifications
let notifiedNewProposals = new Set(); // Track new proposal notifications

document.addEventListener('DOMContentLoaded', function() {
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  // Calendar Setup with text labels
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    events: loadAllEvents,
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
    
    // Create the proposal document
    db.collection('proposals').add({
      date: date,
      time: time,
      proposedBy: currentUser,
      acceptedBy: [currentUser],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      notified: false, // Track if confirmation Discord notification was sent
      proposalNotified: false // Track if new proposal notification was sent
    }).then((docRef) => {
      const proposalId = docRef.id;
      
      // Send notification for new proposal
      sendNewProposalNotification({
        date: date,
        time: time,
        proposedBy: currentUser,
        acceptedBy: [currentUser],
        id: proposalId
      });
      
      // Clear form and update UI
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
          
          // Skip notification logic here - we'll handle it only in toggleAcceptance
          // This prevents duplicate notifications
          
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
      
      // Update the database first
      proposalRef.update({
        acceptedBy: updatedAcceptedBy
      }).then(() => {
        // Only after the update is complete, check if this action confirmed the meetup
        // This is when a new person joined and made it exactly 4 people
        if (updatedAcceptedBy.length === 4 && !proposal.notified && !isAccepted) {
          // Double-check that we haven't already notified about this proposal
          if (!notifiedProposals.has(proposalId)) {
            notifiedProposals.add(proposalId);
            
            // Mark as notified immediately to prevent race conditions
            proposalRef.update({ notified: true }).then(() => {
              // Get the latest data after the update
              proposalRef.get().then(updatedDoc => {
                if (updatedDoc.exists) {
                  const updatedProposal = updatedDoc.data();
                  sendConfirmationNotification(updatedProposal, proposalId);
                }
              });
            });
          }
        }
        calendar.refetchEvents();
      });
    }).catch(error => console.error("Toggle error:", error));
  };

  // Send Discord Notification for Confirmed Meetups
  function sendConfirmationNotification(proposal, proposalId) {
    // Format date and time for better readability
    const formattedDate = formatDate(proposal.date);
    const timeStr = proposal.time;
    
    // Create rich embed for Discord webhook
    const webhookData = {
      content: "@everyone A badminton meetup has been confirmed! :badminton:",
      embeds: [{
        title: "Badminton Meetup Confirmed!",
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
          text: "See you on the court! 🏸"
        }
      }]
    };
    
    console.log("Sending confirmation notification");
    
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

  // Send Discord Notification for New Proposals
  function sendNewProposalNotification(proposal) {
    // Mark as notified in Firebase
    db.collection('proposals').doc(proposal.id).update({ proposalNotified: true });
    notifiedNewProposals.add(proposal.id);
    
    // Format date and time for better readability
    const formattedDate = formatDate(proposal.date);
    const timeStr = proposal.time;
    
    // Calculate spots remaining
    const spotsRemaining = 4 - proposal.acceptedBy.length;
    
    // Create rich embed for Discord webhook (without @everyone)
    const webhookData = {
      content: "A new badminton meetup has been proposed! 🏸",
      embeds: [{
        title: "New Badminton Meetup Proposal",
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
            name: "Current Participants",
            value: proposal.acceptedBy.join(", "),
            inline: true
          },
          {
            name: "Spots Remaining",
            value: `${spotsRemaining} out of 4`,
            inline: true
          }
        ],
        footer: {
          text: "Join in the app to secure your spot!"
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
      console.log("Discord new proposal notification sent successfully!");
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
        // Store data before deletion for notification
        const proposalData = {...data};
        
        proposalRef.delete().then(() => {
          console.log("Proposal successfully deleted!");
          
          // Notify Discord that the proposal was deleted
          sendProposalDeletedNotification(proposalData);
          
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

  // Send notification when a proposal is deleted
  function sendProposalDeletedNotification(proposal) {
    // Format date and time for better readability
    const formattedDate = formatDate(proposal.date);
    const timeStr = proposal.time;
    
    // Create rich embed for Discord webhook
    const webhookData = {
      content: "A badminton meetup proposal has been canceled.",
      embeds: [{
        title: "Badminton Meetup Canceled",
        color: 15548997, // Light red color
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
            name: "Canceled By",
            value: currentUser,
            inline: true
          }
        ],
        footer: {
          text: "This meetup has been removed from the schedule."
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
      console.log("Discord cancellation notification sent successfully!");
    })
    .catch(error => console.error("Error sending Discord notification:", error));
  }

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
            start: `${data
