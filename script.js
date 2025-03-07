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

const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "badminton-meet.firebaseapp.com",
    projectId: "badminton-meet",
    storageBucket: "badminton-meet.appspot.com",
    messagingSenderId: "123...",
    appId: "1:123...:web:abc..."
};

// Global Variables
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    // Check if Firebase SDK is loaded
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded. Check your script tag.');
        return;
    }

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // Calendar Setup
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) {
        console.error('Calendar element not found!');
        return;
    }
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        events: loadConfirmedEvents
    });
    calendar.render();

    // Login Function
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

    // Propose a Meetup
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
        }).catch(error => {
            console.error('Error proposing meetup:', error);
            alert('Failed to propose meetup.');
        });
    };

    // Load Proposals
    function loadProposals() {
        const proposalsList = document.getElementById('proposals-list');
        if (!proposalsList) {
            console.error('Proposals list element not found!');
            return;
        }
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
            }, error => {
                console.error('Error loading proposals:', error);
                proposalsList.innerHTML = 'Failed to load proposals.';
            });
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
        }).catch(error => {
            console.error('Error toggling acceptance:', error);
        });
    };

    // Load Confirmed Events for Calendar
    function loadConfirmedEvents(fetchInfo, successCallback) {
        db.collection('proposals')
            .get() // Fetch all proposals
            .then(snapshot => {
                const events = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.acceptedBy && data.acceptedBy.length >= 4) { // Filter client-side
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
                console.error('Error loading calendar events:', error);
                successCallback([]); // Fallback to empty array
            });
    }
});
