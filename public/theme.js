// Apply the device's saved theme before the page paints.
(()=>{
 let theme;
 try{theme=localStorage.getItem('courtside-theme');}catch{}
 if(!['light','dark'].includes(theme))theme=window.matchMedia?.('(prefers-color-scheme: light)').matches?'light':'dark';
 document.documentElement.dataset.theme=theme;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#f4f6ef':'#141c19');
})();
