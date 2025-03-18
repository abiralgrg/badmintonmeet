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
let currentFilter = 'all';

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

  function loadAllEvents(info, successCallback) {
    db.collection('proposals').get().then(snapshot => {
      const events = [];
      snapshot.forEach(doc => {
        const proposal = doc.data();
        const dateTime = new Date(${proposal.date}T${proposal.time});
        const acceptedBy = Array.isArray(proposal.acceptedBy) ? proposal.acceptedBy : [];
        const isBooked = proposal.isBooked === true;

        events.push({
          title: 'Badminton Meet',
          start: dateTime,
          extendedProps: {
            status: isBooked ? 'booked' : (acceptedBy.length >= 4 ? 'confirmed' : 'proposed'),
            participants: acceptedBy,
            venue: proposal.venue || 'Not booked'
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

            if (arg.event.extendedProps.status === 'booked') {
              eventContainer.innerHTML = `

Booked @ ${timeText}

;
            } else if (arg.event.extendedProps.status === 'confirmed') {
              eventContainer.innerHTML = 

Confirmed @ ${timeText}

;
            } else {
              eventContainer.innerHTML = 

Proposed @ ${timeText}

`;
            }

            return { domNodes: [eventContainer] };
          },
          eventDidMount: function(info) {
            const participantsText = info.event.extendedProps.participants.join(', ');
            const count = info.event.extendedProps.participants.length;
            let status = info.event.extendedProps.status === 'booked' ? 'Booked' : 
                         (info.event.extendedProps.status === 'confirmed' ? 'Confirmed' : 'Proposed');
            const venue = info.event.extendedProps.venue || 'Not booked';
            info.el.title = ${status} Badminton (${count}/4)\nParticipants: ${participantsText}\nVenue: ${venue};
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
    return ${hours}:${minutes} ${ampm};
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
      setupBookingView();
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
      isBooked: false,
      venue: null
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
          const isBooked = proposal.isBooked === true;
          const venue = proposal.venue || null;

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
          div.className = proposal ${isBooked ? 'booked' : (isConfirmed ? 'confirmed' : '')};

          let statusText = isBooked ? 'Booked' : (isConfirmed ? 'Confirmed' : 'Proposed');
          let venueBadge = '';
          if (venue) {
            venueBadge = ${venue};
          }

          div.innerHTML = `

              ${formattedDate}
              ${proposal.time}
              ${statusText}${venueBadge}

By: ${proposal.proposedBy}

Players: ${acceptedBy.join(', ')} (${acceptedCount}/4)

                ${acceptedBy.includes(currentUser) ? 'Leave' : 'Join'}

              ${isProposer ? Delete : ''}
              ${(isConfirmed && !isBooked) ? Book Court : ''}
              ${isBooked ? Unbook : ''}

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
        if (calendar && !isMobileView) {
          calendar.refetchEvents();
        }
        refreshBookingList();
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
          refreshBookingList();
        })
        .catch(error => console.error("Error deleting proposal:", error));
    }
  };

  window.markProposalAsBooked = function(proposalId, venue) {
    if (!venue) {
      alert('Please select a venue');
      return;
    }

    db.collection('proposals').doc(proposalId).update({
      isBooked: true,
      venue: venue,
      bookedBy: currentUser,
      bookedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      console.log("Proposal marked as booked!");
      if (calendar && !isMobileView) {
        calendar.refetchEvents();
      }
      loadProposals();
      refreshBookingList();

      // Send notification
      db.collection('proposals').doc(proposalId).get().then(doc => {
        if (doc.exists) {
          const proposal = doc.data();
          sendBookingNotification(proposal, proposalId, venue);
        }
      });
    }).catch(error => console.error("Error marking as booked:", error));
  };

  window.unbookProposal = function(proposalId) {
    if (confirm('Are you sure you want to unbook this meetup?')) {
      db.collection('proposals').doc(proposalId).update({
        isBooked: false,
        venue: null,
        bookedBy: null,
        bookedAt: null
      }).then(() => {
        console.log("Proposal marked as unbooked!");
        if (calendar && !isMobileView) {
          calendar.refetchEvents();
        }
        loadProposals();
        refreshBookingList();
      }).catch(error => console.error("Error unmarking booking:", error));
    }
  };

  window.showBookingOptions = function(proposalId) {
    // Get all proposals for display
    refreshBookingList();

    // Highlight the selected proposal
    setTimeout(() => {
      const proposalElement = document.querySelector([data-proposal-id="${proposalId}"]);
      if (proposalElement) {
        proposalElement.scrollIntoView({ behavior: 'smooth' });
        proposalElement.classList.add('highlighted');
        setTimeout(() => proposalElement.classList.remove('highlighted'), 2000);
      }
    }, 300);
  };

  function setupBookingView() {
    const bookingContainer = document.getElementById('booking-container');
    if (!bookingContainer) return;

    // Clear existing content
    bookingContainer.innerHTML = '';

    // Create header
    const header = document.createElement('div');
    header.className = 'booking-header';
    header.innerHTML = '

Court Booking

';
    bookingContainer.appendChild(header);

 // Create filters
  const filters = document.createElement('div');
  filters.className = 'booking-filters';
  filters.innerHTML = `
    <button class="filter-button active" data-filter="all">All</button>
    <button class="filter-button" data-filter="proposed">Proposed</button>
    <button class="filter-button" data-filter="confirmed">Confirmed</button>
    <button class="filter-button" data-filter="booked">Booked</button>
  `;
  bookingContainer.appendChild(filters);
  
  // Add filter functionality
  const filterButtons = filters.querySelectorAll('.filter-button');
  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      currentFilter = this.getAttribute('data-filter');
      filterButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      refreshBookingList();
    });
  });
  
  // Create booking list container with animation
  const bookingListContainer = document.createElement('div');
  bookingListContainer.className = 'booking-list-container';
  bookingContainer.appendChild(bookingListContainer);
  
  // Create booking instructions
  const bookingInstructions = document.createElement('div');
  bookingInstructions.className = 'booking-instructions';
  bookingInstructions.innerHTML = `
    <div class="instructions-card">
      <h3>How to Book a Court</h3>
      <ol>
        <li>Find a confirmed meetup below</li>
        <li>Click "Book Court" to see venue options</li>
        <li>Select a venue and complete the booking on their website</li>
        <li>Mark the meetup as booked after completing your reservation</li>
      </ol>
      <div class="venue-info">
        <div class="venue">
          <h4>QMC Sports Centre</h4>
          <p>£16/hour</p>
          <p>4 courts available</p>
          <a href="https://bookings.qmc.ac.uk/Book/Book.aspx?group=1&site=1" target="_blank" class="venue-link">Book at QMC</a>
        </div>
        <div class="venue">
          <h4>Everest Community Centre</h4>
          <p>£12/hour</p>
          <p>2 courts available</p>
          <a href="https://www.lifestylefitness.co.uk/club/basingstoke#sports-bookings" target="_blank" class="venue-link">Book at Everest</a>
        </div>
      </div>
    </div>
  `;
  bookingContainer.appendChild(bookingInstructions);
  
  // Initial refresh
  refreshBookingList();
});

function refreshBookingList() {
  const bookingListContainer = document.querySelector('.booking-list-container');
  if (!bookingListContainer) return;
  
  bookingListContainer.innerHTML = '<div class="loading-animation">Loading proposals...</div>';
  
  db.collection('proposals')
    .orderBy('date', 'asc')
    .get()
    .then(snapshot => {
      bookingListContainer.innerHTML = '';
      
      // Filter proposals based on the current filter
      let proposals = [];
      snapshot.forEach(doc => {
        const proposal = doc.data();
        proposal.id = doc.id;
        
        const acceptedBy = Array.isArray(proposal.acceptedBy) ? proposal.acceptedBy : [];
        const isConfirmed = acceptedBy.length >= 4;
        const isBooked = proposal.isBooked === true;
        const proposalDate = new Date(`${proposal.date}T${proposal.time}`);
        const isPast = proposalDate < new Date();
        
        // Skip past proposals
        if (isPast) return;
        
        // Apply filters
        if (currentFilter === 'all' || 
           (currentFilter === 'proposed' && !isConfirmed && !isBooked) ||
           (currentFilter === 'confirmed' && isConfirmed && !isBooked) ||
           (currentFilter === 'booked' && isBooked)) {
          proposals.push(proposal);
        }
      });
      
      if (proposals.length === 0) {
        bookingListContainer.innerHTML = '<div class="no-proposals">No meetups found matching the selected filter</div>';
        return;
      }
      
      // Sort proposals by date
      proposals.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA - dateB;
      });
      
      // Create proposal cards with animation
      proposals.forEach((proposal, index) => {
        const proposalId = proposal.id;
        const acceptedBy = Array.isArray(proposal.acceptedBy) ? proposal.acceptedBy : [];
        const acceptedCount = acceptedBy.length;
        const isConfirmed = acceptedCount >= 4;
        const isBooked = proposal.isBooked === true;
        const venue = proposal.venue || null;
        
        const dateObj = new Date(proposal.date + 'T' + proposal.time);
        const formattedDate = dateObj.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        });
        
        const formattedTime = formatTime(dateObj);
        
        const card = document.createElement('div');
        card.className = `booking-card ${isBooked ? 'booked' : (isConfirmed ? 'confirmed' : 'proposed')}`;
        card.setAttribute('data-proposal-id', proposalId);
        card.style.animationDelay = `${index * 0.1}s`;
        
        let statusText = isBooked ? 'Booked' : (isConfirmed ? 'Confirmed' : 'Proposed');
        let venueInfo = venue ? `<div class="card-venue">Venue: ${venue}</div>` : '';
        
        card.innerHTML = `
          <div class="card-header">
            <div class="card-date">${formattedDate}</div>
            <div class="card-time">${formattedTime}</div>
            <div class="card-status ${isBooked ? 'status-booked' : (isConfirmed ? 'status-confirmed' : 'status-proposed')}">${statusText}</div>
          </div>
          <div class="card-content">
            <div class="card-proposer">Proposed by: ${proposal.proposedBy}</div>
            <div class="card-participants">
              <div class="participant-count">Players: ${acceptedCount}/4</div>
              <div class="participants-list">${acceptedBy.join(', ')}</div>
            </div>
            ${venueInfo}
          </div>
          <div class="card-actions">
            ${!isBooked && acceptedBy.includes(currentUser) ? 
              `<button class="action-button leave-button" onclick="toggleAcceptance('${proposalId}', true)">Leave</button>` : 
              (!isBooked && !acceptedBy.includes(currentUser) ? 
                `<button class="action-button join-button" onclick="toggleAcceptance('${proposalId}', false)">Join</button>` : '')}
            
            ${proposal.proposedBy === currentUser ? 
              `<button class="action-button delete-button" onclick="deleteProposal('${proposalId}')">Delete</button>` : ''}
            
            ${isConfirmed && !isBooked ? 
              `<button class="action-button book-button" onclick="showBookingModal('${proposalId}')">Book Court</button>` : ''}
            
            ${isBooked ? 
              `<button class="action-button unbook-button" onclick="unbookProposal('${proposalId}')">Unbook</button>` : ''}
          </div>
        `;
        
        bookingListContainer.appendChild(card);
      });
    })
    .catch(error => {
      console.error("Error loading proposals for booking view:", error);
      bookingListContainer.innerHTML = '<div class="error-message">Error loading proposals. Please try again.</div>';
    });
}

window.showBookingModal = function(proposalId) {
  // Remove any existing modals
  const existingModal = document.querySelector('.booking-modal');
  if (existingModal) existingModal.remove();
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'booking-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Book a Court</h3>
        <button class="close-button" onclick="closeBookingModal()">×</button>
      </div>
      <div class="modal-body">
        <p>Select a venue to book:</p>
        <div class="venue-selection">
          <button class="venue-select-button" onclick="openVenueWebsite('qmc')">QMC Sports Centre (£16)</button>
          <button class="venue-select-button" onclick="openVenueWebsite('everest')">Everest Centre (£12)</button>
        </div>
        <div class="venue-booking-status">
          <p>After booking on the venue's website, mark this meetup as booked:</p>
          <div class="mark-booked-buttons">
            <button class="action-button" onclick="markProposalAsBooked('${proposalId}', 'QMC')">Booked at QMC</button>
            <button class="action-button" onclick="markProposalAsBooked('${proposalId}', 'Everest')">Booked at Everest</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add animation class after a small delay
  setTimeout(() => modal.classList.add('active'), 10);
};

window.closeBookingModal = function() {
  const modal = document.querySelector('.booking-modal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 300);
  }
};

window.openVenueWebsite = function(venue) {
  let url = '';
  if (venue === 'qmc') {
    url = 'https://bookings.qmc.ac.uk/Book/Book.aspx?group=1&site=1';
  } else if (venue === 'everest') {
    url = 'https://www.lifestylefitness.co.uk/club/basingstoke#sports-bookings';
  }
  
  window.open(url, '_blank');
};

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

function sendBookingNotification(proposal, proposalId, venue) {
  const formattedDate = formatDate(proposal.date);
  const timeStr = proposal.time;
  
  const webhookData = {
    content: "@everyone A badminton court has been booked! :badminton:",
    embeds: [{
      title: "Badminton Court Booked!",
      color: 3066993, // Green color
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
          name: "Venue",
          value: venue,
          inline: true
        },
        {
          name: "Booked By",
          value: currentUser,
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
    console.log("Discord booking notification sent successfully!");
  })
  .catch(error => console.error("Error sending Discord notification:", error));
}

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
        const isBooked = proposal.isBooked === true;
        const venue = proposal.venue || null;
        
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
        div.className = `proposal ${isBooked ? 'booked' : (isConfirmed ? 'confirmed' : '')}`;
        
        let statusText = isBooked ? 'Booked' : (isConfirmed ? 'Confirmed' : 'Proposed');
        let venueBadge = venue ? `<span class="venue-badge">${venue}</span>` : '';
        
        div.innerHTML = `
          <div class="proposal-header">
            <span class="proposal-date">${formattedDate}</span>
            <span class="proposal-time">${proposal.time}</span>
            <span class="proposal-status">${statusText} ${venueBadge}</span>
          </div>
          <p class="proposal-info">By: ${proposal.proposedBy}</p>
          <p class="proposal-participants">Players: ${acceptedBy.join(', ')} <span class="participant-count">(${acceptedCount}/4)</span></p>
          <div class="proposal-actions">
            ${!isBooked ? `
              <button class="action-button ${acceptedBy.includes(currentUser) ? 'leave-button' : 'join-button'}" onclick="toggleAcceptance('${proposalId}', ${acceptedBy.includes(currentUser)})">
                ${acceptedBy.includes(currentUser) ? 'Leave' : 'Join'}
              </button>
            ` : ''}
            ${isProposer ? `<button class="action-button delete-button" onclick="deleteProposal('${proposalId}')">Delete</button>` : ''}
            ${(isConfirmed && !isBooked) ? `<button class="action-button book-button" onclick="showBookingModal('${proposalId}')">Book Court</button>` : ''}
            ${isBooked ? `<button class="action-button unbook-button" onclick="unbookProposal('${proposalId}')">Unbook</button>` : ''}
          </div>
        `;
        proposalsList.appendChild(div);
      });
      if (calendar && !isMobileView) {
        calendar.refetchEvents();
      }
    }, error => console.error("Error loading proposals:", error));
}

// Update toggleView to include the booking view functionality
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
    refreshBookingList(); // Refresh the booking list when switching to this view
  }
};

function setupBookingView() {
  const bookingContainer = document.getElementById('booking-container');
  if (!bookingContainer) return;
  
  // Clear existing content
  bookingContainer.innerHTML = '';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'booking-header';
  header.innerHTML = '<h2>Court Booking</h2>';
  bookingContainer.appendChild(header);
  
  // Create filters
  const filters = document.createElement('div');
  filters.className = 'booking-filters';
  filters.innerHTML = `
    <button class="filter-button active" data-filter="all">All</button>
    <button class="filter-button" data-filter="proposed">Proposed</button>
    <button class="filter-button" data-filter="confirmed">Confirmed</button>
    <button class="filter-button" data-filter="booked">Booked</button>
  `;
  bookingContainer.appendChild(filters);
  
  // Add filter functionality
  const filterButtons = filters.querySelectorAll('.filter-button');
  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      currentFilter = this.getAttribute('data-filter');
      filterButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      refreshBookingList();
    });
  });
  
  // Create booking list container with animation
  const bookingListContainer = document.createElement('div');
  bookingListContainer.className = 'booking-list-container';
  bookingContainer.appendChild(bookingListContainer);
  
  // Create booking instructions
  const bookingInstructions = document.createElement('div');
  bookingInstructions.className = 'booking-instructions';
  bookingInstructions.innerHTML = `
    <div class="instructions-card">
      <h3>How to Book a Court</h3>
      <ol>
        <li>Find a confirmed meetup below</li>
        <li>Click "Book Court" to see venue options</li>
        <li>Select a venue and complete the booking on their website</li>
        <li>Mark the meetup as booked after completing your reservation</li>
      </ol>
      <div class="venue-info">
        <div class="venue">
          <h4>QMC Sports Centre</h4>
          <p>£16/hour</p>
          <p>4 courts available</p>
          <a href="https://bookings.qmc.ac.uk/Book/Book.aspx?group=1&site=1" target="_blank" class="venue-link">Book at QMC</a>
        </div>
        <div class="venue">
          <h4>Everest Community Centre</h4>
          <p>£12/hour</p>
          <p>2 courts available</p>
          <a href="https://www.lifestylefitness.co.uk/club/basingstoke#sports-bookings" target="_blank" class="venue-link">Book at Everest</a>
        </div>
      </div>
    </div>
  `;
  bookingContainer.appendChild(bookingInstructions);
  
  // Initial refresh
  refreshBookingList();
}
