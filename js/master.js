const button = document.querySelector(".toggle");
const menu = document.querySelector(".menu");
const titelBar = document.querySelector('.titelBar');
const mediaQuery = window.matchMedia('(min-width: 660px)');

button.addEventListener('click', () => {
  menu.classList.toggle('show');
  button.classList.toggle('change');
});

function handleViewportChange(e) {
  if (e.matches) {
    titelBar.classList.remove('active');
  } else {
    titelBar.classList.add('active');
  }
}

handleViewportChange(mediaQuery);
mediaQuery.addEventListener('change', handleViewportChange);