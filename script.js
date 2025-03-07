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

// Function to propose a meetup
function proposeMeetup() {
    const name = document.getElementById('nameInput').value;
    const date = document.getElementById('dateInput').value;
    const time = document.getElementById('timeInput').value;

    if (!name || !date || !time) {
        alert("Please fill all fields!");
        return;
    }

    db.collection("proposals").add({
        name,
        date,
        time,
        acceptedBy: [],
        confirmed: false
    }).then(() => {
        alert("Meetup proposed!");
        loadProposals();
    });
}

// Function to load proposals
function loadProposals() {
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
loadProposals();
