// Keep shared links to individual Cannonball views working after the domain move.
const destination = new URL('https://ucsdcannonball.com/');
destination.search = location.search;
destination.hash = location.hash;
document.getElementById('destination').href = destination.href;
location.replace(destination.href);
