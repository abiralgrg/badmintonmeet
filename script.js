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
      document.querySelector('.main').style.display = 'none';
      document.querySelector('.sidebar').style.width = '100%';
      document.querySelector('.sidebar').style.minWidth = '100%';
      document.querySelector('.container').style.flexDirection = 'column';
      
      const sidebarTitle = document.createElement('h1');
      sidebarTitle.textContent = 'Badminton Meet';
      sidebarTitle.classList.add('mobile-title');
      
      const sidebar = document.querySelector('.sidebar');
      if (!document.querySelector('.mobile-title')) {
        sidebar.insertBefore(sidebarTitle, sidebar.firstChild);
      }
    } else {
      document.querySelector('.main').style.display = 'flex';
      document.querySelector('.sidebar').style.width = '300px';
      document.querySelector('.sidebar').style.minWidth = '200px';
      document.querySelector('.container').style.flexDirection = 'row';
      
      const mobileTitle = document.querySelector('.mobile-title');
      if (mobileTitle) {
        mobileTitle.remove();
      }
      
      initializeCalendar();
    }
  }

  // Load events for the calendar
  function loadAllEvents(info, successCallback) {
    db.collection('proposals').get().then(snapshot => {
      const events = [];
      snapshot.forEach(doc => {
        const proposal = doc.data();
        const dateTime = new Date(`${proposal.date}T${proposal.time}`);
        const acceptedBy = Array.isArray(proposal.acceptedBy) ? proposal.acceptedBy : [];
        const isBooked = proposal.isBooked || false;
        
        let status = 'proposed';
        if (acceptedBy.length >= 4) status = 'confirmed';
        if (isBooked) status = 'booked';
        
        events.push({
          title: 'Badminton Meet',
          start: dateTime,
          extendedProps: {
            status: status,
            participants: acceptedBy,
            isBooked: isBooked
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
            const status = arg.event.extendedProps.status;
            
            if (status === 'booked') {
              eventContainer.innerHTML = `<div class="event-text booked">Booked @ ${timeText}</div>`;
            } else if (status === 'confirmed') {
              eventContainer.innerHTML = `<div class="event-text confirmed">Confirmed @ ${timeText}</div>`;
            } else {
              eventContainer.innerHTML = `<div class="event-text proposed">Proposed @ ${timeText}</div>`;
            }
            
            return { domNodes: [eventContainer] };
          },
          eventDidMount: function(info) {
            const participantsText = info.event.extendedProps.participants.join(', ');
            const count = info.event.extendedProps.participants.length;
            const isBooked = info.event.extendedProps.isBooked ? 'Booked' : '';
            const status = info.event.extendedProps.status === 'confirmed' ? 'Confirmed' : 'Proposed';
            info.el.title = `${status} ${isBooked} Badminton (${count}/4)\nParticipants: ${participantsText}`;
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

  // Format date to display in the booking list
  function formatDateForBooking(dateStr) {
    const date = new Date(dateStr);
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  }

  window.login = function() {
    const name = document.getElementById('user-name').value.trim();
    if (name) {
      currentUser = name;
      document.getElementById('login-section').style.display = 'none';
      document.getElementById('propose-section').style.display = 'block';
      loadProposals();
      initializeBookingList();
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
      proposalNotified: false,
      isBooked: false
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
      initializeBookingList();
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
          const isBooked = proposal.isBooked || false;
          
          if (isConfirmed && !proposal.notified && !notifiedProposals.has(proposalId)) {
            sendConfirmationNotification(proposal, proposalId);
            notifiedProposals.add(proposalId);
            
            db.collection('proposals').doc(proposalId).update({
              notified: true
            });
          }
          
          const dateObj = new Date(proposal.date);
          const formattedDate = dateObj.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });
          
          const div = document.createElement('div');
          div.className = `proposal ${isConfirmed ? 'confirmed' : ''} ${isBooked ? 'booked' : ''}`;
          div.innerHTML = `
            <div class="proposal-header">
              <span class="proposal-date">${formattedDate}</span>
              <span class="proposal-time">${proposal.time}</span>
              <span class="proposal-status">
                ${isConfirmed ? 'Confirmed' : 'Proposed'}
                ${isBooked ? '<span class="booking-badge">Booked</span>' : ''}
              </span>
            </div>
            <p class="proposal-info">By: ${proposal.proposedBy}</p>
            <p class="proposal-participants">Players: ${acceptedBy.join(', ')} <span class="participant-count">(${acceptedCount}/4)</span></p>
            <div class="proposal-actions">
              <button class="action-button ${acceptedBy.includes(currentUser) ? 'leave-button' : 'join-button'}" onclick="toggleAcceptance('${proposalId}', ${acceptedBy.includes(currentUser)})">
                ${acceptedBy.includes(currentUser) ? 'Leave' : 'Join'}
              </button>
              ${isProposer ? `<button class="action-button delete-button" onclick="deleteProposal('${proposalId}')">Delete</button>` : ''}
              ${isConfirmed ? `
                <button class="action-button ${isBooked ? 'unbook-button' : 'book-court-button'}" onclick="${isBooked ? `toggleBooking('${proposalId}', true)` : `showBookingOptions('${proposalId}')`}">
                  ${isBooked ? 'Unbook' : 'Book Court'}
                </button>
              ` : ''}
            </div>
          `;
          proposalsList.appendChild(div);
        });
        if (calendar && !isMobileView) {
          calendar.refetchEvents();
        }
      }, error => console.error("Error loading proposals:", error));
  }

  // Initialize booking list view
  function initializeBookingList() {
    const bookingContainer = document.getElementById('booking-container');
    if (!bookingContainer) return;
    
    // Clear existing content
    bookingContainer.innerHTML = '';
    
    // Create header
    const bookingHeader = document.createElement('div');
    bookingHeader.className = 'booking-header';
    bookingHeader.innerHTML = '<h2>Badminton Bookings</h2>';
    bookingContainer.appendChild(bookingHeader);
    
    // Create filters
    const bookingFilters = document.createElement('div');
    bookingFilters.className = 'booking-filters';
    bookingFilters.innerHTML = `
      <button class="filter-button active" onclick="filterBookings('all')">All</button>
      <button class="filter-button" onclick="filterBookings('confirmed')">Confirmed</button>
      <button class="filter-button" onclick="filterBookings('booked')">Booked</button>
    `;
    bookingContainer.appendChild(bookingFilters);
    
    // Create booking list container
    const bookingList = document.createElement('div');
    bookingList.className = 'booking-list';
    bookingList.id = 'booking-list';
    bookingContainer.appendChild(bookingList);
    
    // Load bookings
    loadBookings();
  }
  
  // Load bookings for the booking list
  function loadBookings() {
    const bookingList = document.getElementById('booking-list');
    if (!bookingList) return;
    
    bookingList.innerHTML = '<div class="loading">Loading bookings...</div>';
    
    db.collection('proposals')
      .orderBy('date', 'asc')
      .onSnapshot(snapshot => {
        const proposals = [];
        snapshot.forEach(doc => {
          const proposal = doc.data();
          proposal.id = doc.id;
          proposals.push(proposal);
        });
        
        if (proposals.length === 0) {
          bookingList.innerHTML = '<div class="no-bookings">No proposals yet. Create one to get started!</div>';
          return;
        }
        
        displayBookings(proposals);
      }, error => {
        console.error("Error loading bookings:", error);
        bookingList.innerHTML = '<div class="error">Error loading bookings. Please try again.</div>';
      });
  }
  
  // Display bookings in the booking list
  function displayBookings(proposals) {
    const bookingList = document.getElementById('booking-list');
    if (!bookingList) return;
    
    bookingList.innerHTML = '';
    
    proposals.forEach((proposal, index) => {
      const acceptedBy = Array.isArray(proposal.acceptedBy) ? proposal.acceptedBy : [];
      const acceptedCount = acceptedBy.length;
      const isConfirmed = acceptedCount >= 4;
      const isBooked = proposal.isBooked || false;
      
      // Create booking item element
      const bookingItem = document.createElement('div');
      bookingItem.className = `booking-list-item ${isConfirmed ? 'confirmed' : ''} ${isBooked ? 'booked' : ''}`;
      bookingItem.dataset.status = isBooked ? 'booked' : (isConfirmed ? 'confirmed' : 'proposed');
      
      const dateObj = new Date(proposal.date);
      const formattedDate = formatDateForBooking(proposal.date);
      
      bookingItem.innerHTML = `
        <div class="booking-details">
          <div class="booking-date-time">
            ${formattedDate} at ${proposal.time}
            <span class="booking-status ${isBooked ? 'booked' : (isConfirmed ? 'confirmed' : '')}">
              ${isBooked ? 'Booked' : (isConfirmed ? 'Confirmed' : 'Proposed')}
            </span>
          </div>
          <div class="booking-participants">
            ${acceptedBy.join(', ')} <span class="participant-count">(${acceptedCount}/4)</span>
          </div>
          ${isBooked ? `<div class="venue-badge">Booking Confirmed</div>` : ''}
        </div>
        <div class="booking-actions">
          ${isConfirmed && !isBooked ? `
            <div class="venue-options">
              <button class="venue-link-button" onclick="openBookingURL('qmc')">QMC (£16)</button>
              <button class="venue-link-button" onclick="openBookingURL('everest')">Everest (£12)</button>
            </div>
            <button class="action-button book-court-button" onclick="toggleBooking('${proposal.id}', false)">Mark as Booked</button>
          ` : ''}
          ${isBooked ? `
            <button class="action-button unbook-button" onclick="toggleBooking('${proposal.id}', true)">Mark as Unbooked</button>
          ` : ''}
        </div>
      `;
      
      bookingList.appendChild(bookingItem);
    });
  }
  
  // Open booking URL in new tab
  window.openBookingURL = function(venue) {
    const urls = {
      qmc: 'https://bookings.qmc.ac.uk/Book/Book.aspx?group=1&site=1',
      everest: 'https://www.lifestylefitness.co.uk/club/basingstoke#sports-bookings'
    };
    
    if (urls[venue]) {
      window.open(urls[venue], '_blank');
    }
  };
  
  // Show booking options for a proposal
  window.showBookingOptions = function(proposalId) {
    const bookingOptions = document.createElement('div');
    bookingOptions.className = 'booking-options-dialog';
    bookingOptions.innerHTML = `
      <div class="booking-options-content">
        <h3>Choose a Venue</h3>
        <div class="venue-options">
          <button onclick="openBookingURL('qmc'); toggleBooking('${proposalId}', false)">QMC (£16)</button>
          <button onclick="openBookingURL('everest'); toggleBooking('${proposalId}', false)">Everest (£12)</button>
        </div>
        <div class="booking-options-actions">
          <button onclick="toggleBooking('${proposalId}', false)">Mark as Booked</button>
          <button onclick="closeBookingOptions()">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(bookingOptions);
  };
  
  // Close booking options dialog
  window.closeBookingOptions = function() {
    const dialog = document.querySelector('.booking-options-dialog');
    if (dialog) {
      dialog.remove();
    }
  };
  
  // Toggle booking status
  window.toggleBooking = function(proposalId, isCurrentlyBooked) {
    const proposalRef = db.collection('proposals').doc(proposalId);
    
    proposalRef.update({
      isBooked: !isCurrentlyBooked
    }).then(() => {
      closeBookingOptions();
      loadProposals();
      loadBookings();
      if (calendar && !isMobileView) {
        calendar.refetchEvents();
      }
    }).catch(error => {
      console.error("Error updating booking status:", error);
      alert("Failed to update booking status. Please try again.");
    });
  };
  
  // Filter bookings in the booking list
  window.filterBookings = function(filter) {
    const filterButtons = document.querySelectorAll('.filter-button');
    filterButtons.forEach(button => {
      button.classList.remove('active');
      if (button.textContent.toLowerCase() === filter) {
        button.classList.add('active');
      }
    });
    
    const bookingItems = document.querySelectorAll('.booking-list-item');
    bookingItems.forEach(item => {
      if (filter === 'all') {
        item.style.display = 'flex';
      } else {
        if (item.dataset.status === filter) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      }
    });
  };
  
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
        if (calendar && !isMobileView) {
          calendar.refetchEvents();
        }
        loadBookings();
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
          loadBookings();
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
          text: "Join the meet at https://abiralgrg.github.io/badmintonmeet."
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

  window.toggleView = function(view) {
    const calendarContainer = document.getElementById('calendar-container');
    const chatContainer = document.getElementById('chat-container');
    const bookingContainer = document.getElementById('booking-container');
    const calendarToggle = document.getElementById('calendar-toggle');
    const chatToggle = document.getElementById('chat-toggle');
    const bookingToggle = document.getElementById('booking-toggle');
    
    // Hide all containers first
    calendarContainer.style.display = 'none';
    chatContainer.style.display = 'none';
    if (bookingContainer) bookingContainer.style.display = 'none';
    
    // Remove active class from all toggles
    calendarToggle.classList.remove('active');
    chatToggle.classList.remove('active');
    if (bookingToggle) bookingToggle.classList.remove('active');
    
    // Show the selected container and activate the toggle
    if (view === 'calendar') {
      calendarContainer.style.display = 'flex';
      calendarToggle.classList.add('active');
      if (calendar) {
        calendar.updateSize();
      }
    } else if (view === 'chat') {
      chatContainer.style.display = 'flex';
      chatToggle.classList.add('active');
    } else if (view === 'booking' && bookingContainer) {
      bookingContainer.style.display = 'flex';
      bookingToggle.classList.add('active');
      if (currentUser) {
        initializeBookingList();
      }
    }
  };

  // Initialize app on load
  if (!isMobileView) {
    initializeCalendar();
  }

  // Ensure booking list is initialized when user is logged in
  if (currentUser) {
    initializeBookingList();
  }
});
