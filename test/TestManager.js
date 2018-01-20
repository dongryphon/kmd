'use strict';

/* global describe */

const Phyl = require('phylo');
const expect = require('assertly').expect;

const { Manager } = require('../src/Context');

const baseDir = Phyl.from(__dirname).resolve('..');
const projectsDir = baseDir.resolve('test/projects');

class TestManager extends Manager {
    constructor () {
        super();

        this.messages = [];

        this.logger = {
            error: m => this._log('ERR', m),
            info:  m => this._log('INF', m),
            log:   m => this._log('DBG', m),
            warn:  m => this._log('WRN', m)
        };
    }

    _log (level, msg) {
        this.messages.push(`${level}: ${msg}`);
    }

    fixAbsolutePaths () {
        this.messages = this.messages.map(m => {
            let start = m.lastIndexOf('--') + 3;
            let end = m.lastIndexOf(':', m.lastIndexOf(':') - 1);
            let a = m.substr(0, start);
            let b = Phyl.from(m.substring(start, end));
            let c = m.substr(end);

            expect(b.isAbsolute()).to.be(true);

            let r = b.relativize(this.baseDir).slashify();

            return a + r.path + c;
        });
    }
}


module.exports = {
    baseDir,
    projectsDir,

    TestManager,

    getClassNamesForSymbols (symbols) {
        let classes = symbols.classes;
        expect(classes).to.not.be(null);
        classes.sort();

        let classNames = classes.items.map(it => it.name);
        return [classes, classNames];
    }
};
