'use strict';

function Empty () {}
Empty.prototype = Object.create(null);

const Utils = {
    Empty,

    capitalize (str) {
        return str && (str[0].toUpperCase() + str.substr(1));
    },

    distinctinator (rule) {
        let map = {};
        return d => {
            let p = d && (rule ? rule(d) : d);
            return p && !map[p] && (map[p] = d);
        };
    },

    distinctifyPaths () {
        return Utils.distinctinator(d => d.exists() && d.absolutePath());
    },

    primitive (v) {
        let t = typeof v;
        return t === 'string' || t === 'number' || t === 'boolean';
    },

    raise (msg) {
        throw new Error(msg);
    }
};

module.exports = Utils;
