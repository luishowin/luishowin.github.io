const modeToggle = document.getElementById('modeToggle');
const body = document.body;

modeToggle.addEventListener('change', () =>{
    body.classList.toggle('dark-mode');
});