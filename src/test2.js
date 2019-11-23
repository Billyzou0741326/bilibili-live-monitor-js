'use strict';


let i = setInterval(() => {
    console.log("Hi.");
}, 1 * 1000);

setTimeout(() => { i && clearInterval(i); }, 10 * 1000);
