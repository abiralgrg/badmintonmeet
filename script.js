const firebaseConfig = {
  apiKey: "AIzaSyBETUme1XqagHowwggApN53A2aINQcAiM8",
  authDomain: "badminton-meet.firebaseapp.com",
  projectId: "badminton-meet",
  storageBucket: "badminton-meet.firebasestorage.app",
  messagingSenderId: "662574308710",
  appId: "1:662574308710:web:b321b63596c2770b247ca7",
  measurementId: "G-2NCW3MYNWN"
};

let currentUser = null;
let calendar = null;
const WEBHOOK_URL = "https://discord.com/api/webhooks/1350865378275754084/2zmhPDKsvH_NsvvBQbJ7MzVTHqlHBRejW-ujKIhdeTHlFGiWIYq6pgNtVT_8nEjMm9WG";
let notifiedProposals = new Set();
let notifiedNewProposals = new Set();
let isMobileView = false;
let db = null;

document.addEventListener('DOMContentLoaded', function() {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();

  checkScreenSize();
  window.addEventListener('resize', checkScreenSize);

  function checkScreenSize() {
    isMobileView = window.innerWidth < 768;
    updateLayoutForScreenSize();
  }

  function updateLayoutForScreenSize() {
    if (isMobileView) {
      // Mobile layout: Hide calendar and chat sections
      document.querySelector('.main').style.display = 'none';
      document.querySelector('.sidebar').style.width = '100%';
      document.querySelector('.sidebar').style.minWidth = '100%';
      document.querySelector('.container').style.flexDirection = 'column';
      
      // Add mobile title at the top
      const sidebarTitle = document.createElement('h1');
      sidebarTitle.textContent = 'Badminton Meet';
      sidebarTitle.classList.add('mobile-title');
      
      const sidebar = document.querySelector('.sidebar');
      if (!document.querySelector('.mobile-title')) {
        sidebar.insertBefore(sidebarTitle, sidebar.firstChild);
      }
    } else {
      // Desktop layout: Show all sections
      document.querySelector('.main').style.display = 'flex';
      document.querySelector('.sidebar').style.width = '300px';
      document.querySelector('.sidebar').style.minWidth = '200px';
      document.querySelector('.container').style.flexDirection = 'row';
      
      // Remove mobile title if it exists
      const mobileTitle = document.querySelector('.mobile-title');
      if (mobileTitle) {
        mobileTitle.remove();
      }
      
      // Initialize calendar for desktop
      initializeCalendar();
    }
  }

  // Define loadAllEvents function first
  function loadAllEvents(info, successCallback) {
    db.collection('proposals').get().then(snapshot => {
      const events = [];
      snapshot.forEach(doc => {
        const proposal = doc.data();
        const dateTime = new Date(`${proposal.date}T${proposal.time}`);
        const acceptedBy = Array.isArray(proposal.acceptedBy) ? proposal.acceptedBy : [];
        
        events.push({
          title: 'Badminton Meet',
          start: dateTime,
          extendedProps: {
            status: acceptedBy.length >= 4 ? 'confirmed' : 'proposed',
            participants: acceptedBy
          }
        });
      });
      successCallback(events);
    }).catch(error => {
      console.error("Error loading events:", error);
      successCallback([]);
    });
  }

  function initializeCalendar() {
    if (!calendar && !isMobileView) {
      const calendarEl = document.getElementById('calendar');
      if (calendarEl) {
        calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: 'dayGridMonth',
          events: loadAllEvents, // This should now be defined
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
      }
    }
  }

  function formatTime(dateObj) {
    if (!dateObj) return '';
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    return `${hours}:${minutes} ${ampm}`;
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  }

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

  window.proposeMeetup = function() {
    const date = document.getElementById('propose-date').value;
    const time = document.getElementById('propose-time').value;
    if (!date || !time || !currentUser) return;
    
    db.collection('proposals').add({
      date: date,
      time: time,
      proposedBy: currentUser,
      acceptedBy: [currentUser],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      notified: false,
      proposalNotified: false 
    }).then((docRef) => {
      const proposalId = docRef.id;
      const proposalData = {
        date: date,
        time: time,
        proposedBy: currentUser,
        acceptedBy: [currentUser],
        id: proposalId
      };
      
      if (!notifiedNewProposals.has(proposalId)) {
        sendProposalNotification(proposalData);
        notifiedNewProposals.add(proposalId);
        
        db.collection('proposals').doc(proposalId).update({
          proposalNotified: true
        });
      }
      
      loadProposals();
      document.getElementById('propose-date').value = '';
      document.getElementById('propose-time').value = '';
      if (calendar && !isMobileView) {
        calendar.refetchEvents();
      }
    }).catch(error => console.error("Propose error:", error));
  };

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
          
          if (isConfirmed && !proposal.notified && !notifiedProposals.has(proposalId)) {
            sendConfirmationNotification(proposal, proposalId);
            notifiedProposals.add(proposalId);
          }
          
          const dateObj = new Date(proposal.date);
          const formattedDate = dateObj.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });
          
          const div = document.createElement('div');
          div.className = `proposal ${isConfirmed ? 'confirmed' : ''}`;
          div.innerHTML = `
            <div class="proposal-header">
              <span class="proposal-date">${formattedDate}</span>
              <span class="proposal-time">${proposal.time}</span>
              <span class="proposal-status">${isConfirmed ? 'Confirmed' : 'Proposed'}</span>
            </div>
            <p class="proposal-info">By: ${proposal.proposedBy}</p>
            <p class="proposal-participants">Players: ${acceptedBy.join(', ')} <span class="participant-count">(${acceptedCount}/4)</span></p>
            <div class="proposal-actions">
              <button class="action-button ${acceptedBy.includes(currentUser) ? 'leave-button' : 'join-button'}" onclick="toggleAcceptance('${proposalId}', ${acceptedBy.includes(currentUser)})">
                ${acceptedBy.includes(currentUser) ? 'Leave' : 'Join'}
              </button>
              ${isProposer ? `<button class="action-button delete-button" onclick="deleteProposal('${proposalId}')">Delete</button>` : ''}
            </div>
          `;
          proposalsList.appendChild(div);
        });
        if (calendar && !isMobileView) {
          calendar.refetchEvents();
        }
      }, error => console.error("Error loading proposals:", error));
  }

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
        if (updatedAcceptedBy.length >= 4 && !proposal.notified && !notifiedProposals.has(proposalId)) {
          proposalRef.get().then(updatedDoc => {
            const updatedProposal = updatedDoc.data();
            sendConfirmationNotification(updatedProposal, proposalId);
            notifiedProposals.add(proposalId);
          });
        }
        if (calendar && !isMobileView) {
          calendar.refetchEvents();
        }
      });
    }).catch(error => console.error("Toggle error:", error));
  };

  window.deleteProposal = function(proposalId) {
    if (confirm('Are you sure you want to delete this proposal?')) {
      db.collection('proposals').doc(proposalId).delete()
        .then(() => {
          console.log("Proposal successfully deleted!");
          if (calendar && !isMobileView) {
            calendar.refetchEvents();
          }
        })
        .catch(error => console.error("Error deleting proposal:", error));
    }
  };

  function sendProposalNotification(proposal) {
    const formattedDate = formatDate(proposal.date);
    const timeStr = proposal.time;
    
    const webhookData = {
      content: "New badminton meet proposal!",
      embeds: [{
        title: "New Badminton Meet Proposal",
        color: 3447003,
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

  function sendConfirmationNotification(proposal, proposalId) {
    const proposalRef = db.collection('proposals').doc(proposalId);
    proposalRef.update({ notified: true });
    
    const formattedDate = formatDate(proposal.date);
    const timeStr = proposal.time;
    
    const webhookData = {
      content: "@everyone A badminton meet has been confirmed! :badminton:",
      embeds: [{
        title: "Badminton Meet Confirmed!",
        color: 5025616, 
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

  // Initialize the app
  if (!isMobileView) {
    initializeCalendar();
  }
});

window.toggleView = function(view) {
  const calendarContainer = document.getElementById('calendar-container');
  const chatContainer = document.getElementById('chat-container');
  const calendarToggle = document.getElementById('calendar-toggle');
  const chatToggle = document.getElementById('chat-toggle');
  
  if (view === 'calendar') {
    calendarContainer.style.display = 'flex';
    chatContainer.style.display = 'none';
    calendarToggle.classList.add('active');
    chatToggle.classList.remove('active');
    if (calendar) {
      calendar.updateSize();
    }
  } else if (view === 'chat') {
    calendarContainer.style.display = 'none';
    chatContainer.style.display = 'flex';
    calendarToggle.classList.remove('active');
    chatToggle.classList.add('active');
  }
};
