const button = document.querySelector(".toggle");
const menu = document.querySelector(".menu");

button.addEventListener('click', () => {
  menu.classList.toggle('show');
  button.classList.toggle('change');
});

function showContent() {
  document.querySelector('.skeleton-wrapper').style.display = 'none';
  document.querySelector('.real-content').style.display = 'block';
}