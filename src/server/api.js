(function() {

    'use strict';

    const { repository } = require('../global/config.js');

    function guardHandler(request, response) {
        const guards = repository.repo['guard'];
        response.jsonp(guards);
    }

    module.exports = {
        guardHandler,
    };

})();
