'use strict';

/* global describe */

const expect = require('assertly').expect;

const { Context } = require('../../src/Context');
const Symbols = require('../../src/Symbols');

const { TestManager, getClassNamesForSymbols, projectsDir } = require('../TestManager');

const Dir = {
    soloApp: projectsDir.join('solo-app'),
    workspace: projectsDir.join('workspace')
};

describe('Symbols', function () {
    describe('basics', async function () {
        beforeEach(function () {
            this.workspace = Context.from(Dir.workspace, this.mgr = new TestManager());
        });

        it('should load classes', async function () {
            this.mgr.pathMode = 'rel';
            let app = this.workspace.apps[0];

            let sources = await app.loadSources();

            let symbols = new Symbols(sources);

            let [classes, classNames] = getClassNamesForSymbols(symbols);

            expect(this.mgr.messages).to.equal([
                'WRN: C1000: Unrecognized use of Ext.define (Expected 2nd argument to be an ' +
                    'object or function returning an object) -- app/app/Application.js:10:1'
            ]);

            expect(classes).to.not.be(null);
            classes.sort();

            expect(classNames).to.equal([
                'WA.Application',
                'WA.MainView',
                'WA.view.main.Main'
            ]);

            // Ensure items are cached:
            let sf = sources.files.items[0];
            let ast = sf._ast;
            expect(sf.ast).to.be(ast);

            let syms = symbols.files.items[0];
            let cls = syms._classes;
            classes = syms.classes;
            expect(cls).to.be(classes);
        });

        it('should remove classes', async function () {
            let app = this.workspace.apps[0];

            let sources = await app.loadSources();

            let symbols = new Symbols(sources);

            expect(symbols.files.length).to.be(2);
            let classes = symbols.classes;

            expect(classes).to.not.be(null);

            this.mgr.fixAbsolutePaths();
            expect(this.mgr.messages).to.equal([
                'WRN: C1000: Unrecognized use of Ext.define (Expected 2nd argument to be an ' +
                    'object or function returning an object) -- app/app/Application.js:10:1'
            ]);

            symbols.sync();

            classes = symbols.classes;
            expect(classes).to.not.be(null);

            expect(symbols.files.length).to.be(2);

            sources.files.remove(sources.files.items[0]);

            symbols.sync();

            expect(symbols.files.length).to.be(1);

            let classNames;
            [classes, classNames] = getClassNamesForSymbols(symbols);

            expect(classNames).to.equal([
                'WA.MainView',
                'WA.view.main.Main'
            ]);
            // expect(classes.items[0].name).to.be('WA.Application');
            // expect(classes.items[0].name).to.be('WA.view.main.Main');

            let mainView = classes.get('WA.view.main.Main');

            expect(mainView).to.be(classes.items[1]);
        });

        it('should provide location for various node types', async function () {
            this.mgr.thresholds['C1000'] = 'error';
            let app = this.workspace.apps[0];

            let sources = await app.loadSources();

            let symbols = new Symbols(sources);
            expect(symbols.files.length).to.be(2);

            let classes = symbols.classes;

            expect(this.mgr.messages).to.equal([]);

            let mainView = classes.get('WA.view.main.Main');
            let fileSyms = mainView.origin;

            let at = { start: mainView.at.start, end: mainView.at.end };
            at = fileSyms._at(at);
            expect(at.start).to.be(mainView.at.start);
            expect(at.end).to.be(mainView.at.end);
            expect(at.file).to.be(fileSyms.file);
        });

        it('should catalog classes by name and alias', async function () {
            this.mgr.levels['C1000'] = 'debug';
            let app = this.workspace.apps[0];

            let sources = await app.loadSources();

            let symbols = new Symbols(sources);
            expect(symbols.files.length).to.be(2);

            let classes = symbols.classes;

            expect(this.mgr.messages).to.equal([]);

            let mainView = classes.get('WA.view.main.Main');
            let fileSyms = mainView.origin;
            let rel = fileSyms.file.relativize(Dir.workspace).slashify();
            let path = fileSyms.path;

            expect(rel.path).to.equal('app/app/view/main/Main.js');
            expect(path).to.be(fileSyms.file.path);

            expect(fileSyms.aliases.items).to.equal([ 'widget.mainview', 'widget.main' ]);
            expect(fileSyms.names.items).to.equal([
                // there are two @define directives followed by Ext.define() of one
                // of the same names and a new alt name:
                'WA.view.main.Main', 'WA.AltMain', 'WA.MainView'
            ]);
            expect(fileSyms.tags.items).to.equal([ 'mainview', 'viewmain' ]);
        });
    });
});
