// Ensure Firebase is available
console.log("Firebase loading...");

// Your Firebase config
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

console.log("Firebase initialized!");

// Function to propose a meetup
function proposeMeetup() {
    console.log("Propose button clicked");
    
    const name = document.getElementById('nameInput').value;
    const date = document.getElementById('dateInput').value;
    const time = document.getElementById('timeInput').value;

    if (!name || !date || !time) {
        alert("Please fill all fields!");
        return;
    }

    console.log("Sending data to Firestore...");

    db.collection("proposals").add({
        name,
        date,
        time,
        acceptedBy: [],
        confirmed: false
    }).then(() => {
        alert("Meetup proposed!");
        console.log("Meetup successfully added!");
        loadProposals();
    }).catch(error => {
        console.error("Error adding document: ", error);
    });
}

// Function to load proposals
function loadProposals() {
    console.log("Loading proposals...");
    const proposalsList = document.getElementById('proposalsList');
    proposalsList.innerHTML = '';

    db.collection("proposals").get().then(snapshot => {
        snapshot.forEach(doc => {
            const data = doc.data();
            const li = document.createElement('li');
            li.innerHTML = `${data.date} ${data.time} - Proposed by ${data.name} 
                (<b>${data.acceptedBy.length}</b> acceptances)
                <button onclick="acceptProposal('${doc.id}')">Accept</button>`;

            proposalsList.appendChild(li);
        });
    });
}

// Function to accept a proposal
function acceptProposal(id) {
    console.log("Accepting proposal:", id);
    
    db.collection("proposals").doc(id).get().then(doc => {
        if (doc.exists) {
            let data = doc.data();
            const name = document.getElementById('nameInput').value;

            if (!name) {
                alert("Enter your name first!");
                return;
            }

            if (!data.acceptedBy.includes(name)) {
                data.acceptedBy.push(name);
            }

            if (data.acceptedBy.length >= 4) {
                data.confirmed = true;
            }

            db.collection("proposals").doc(id).update(data).then(() => {
                alert("Proposal accepted!");
                loadProposals();
            });
        }
    });
}

// Load proposals on startup
window.onload = loadProposals;
