(function() {

    'use strict';

    const express = require('express');
    const router = express.Router({ 'mergeParams': true });

    const api = require('./api.js');

    router.get('/guard', api.guardHandler);

    module.exports = router;

})();
