(function() {

    'use strict';

    function guardHandler(repository, request, response) {
        const guards = repository.repo['guard'];
        response.jsonp(guards);
    }

    module.exports = {
        guardHandler,
    };

})();
