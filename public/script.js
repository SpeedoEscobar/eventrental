function scrollToSection(id){
  document.getElementById(id).scrollIntoView({behavior:"smooth"});
}

document.getElementById("contactForm").addEventListener("submit", async e=>{
  e.preventDefault();

  const response = await fetch("/contact", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      name:e.target[0].value,
      email:e.target[1].value,
      phone:e.target[2].value,
      message:e.target[3].value
    })
  });

  document.getElementById("response").innerText="Message sent!";
  e.target.reset();
});