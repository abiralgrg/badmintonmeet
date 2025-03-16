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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Toggle View (Switch between Calendar and Discord)
function toggleView() {
    const calendarContainer = document.getElementById("calendar-container");
    const discordContainer = document.getElementById("discord-container");

    if (calendarContainer.style.display === "none") {
        calendarContainer.style.display = "flex";
        discordContainer.style.display = "none";
    } else {
        calendarContainer.style.display = "none";
        discordContainer.style.display = "flex";
    }
}

// Login Functionality
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

// Calendar Setup
document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        events: loadAllEvents,
        height: 'auto',
        displayEventTime: false
    });
    calendar.render();
});

// Function to Load Events
function loadAllEvents(fetchInfo, successCallback) {
    db.collection('proposals')
