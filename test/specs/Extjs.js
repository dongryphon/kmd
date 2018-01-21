'use strict';

/* global describe, beforeEach */
const expect = require('assertly').expect;
const Phyl = require('phylo');

const extjsPath = require('@epiphanysoft/extjs');

const { Context } = require('../../src/Context');
const Symbols = require('../../src/Symbols');

const { TestManager, projectsDir } = require('../TestManager');

const extjsDir = Phyl.from(extjsPath);

const Dir = {
    // soloApp: projectsDir.join('solo-app'),
    workspace: projectsDir.join('workspace-classic-app')
};

describe('Extjs', function () {
    beforeEach(function () {
        this.workspace = Context.from(Dir.workspace, this.mgr = new TestManager());
    });

    describe('load', function () {
        it('should load a classic toolkit app', async function () {
            let app = this.workspace.apps[0];

            let fw = app.framework;

            expect(fw.isFramework).to.be(true);

            let catalog = fw.catalog;
            let pkgs = fw.packages;

            debugger
        });

        it('should load sources for a classic toolkit app', async function () {
            let app = this.workspace.apps[0];

            let sources = await app.loadSources();

            let symbols = new Symbols(sources);
            let classes = symbols.classes;
        });
    });
});
