'use strict';

const Phyl = require('phylo');

const { Empty, raise } = require('./util');
const { Manager } = require('./Msg');
const PropertyMap = require('./PropertyMap');
const Sources = require('./Sources');

/**
 * This class is an abstract base class for App, Package and Workspace. Each directory in
 * a Cmd workspace can contain one of the master descriptors (app.json, package.json and/or
 * workspace.json) and these class manage loading and accessing these descriptors.
 *
 * Typically, a context is loaded from the current directory (cwd):
 *
 *      let context = Context.get();
 *
 *      if (context) {
 *          // the cwd corresponds to, or is a subdirectory of, some Cmd context...
 *          if (context.isApp) {
 *              // cwd is an app or a subdir of an app...
 *
 *              let workspace = context.workspace;  // get the workspace
 *          }
 *          else if (context.isPackage) {
 *              // cwd is a package or a subdir of one...
 *
 *              let workspace = context.workspace;
 *          }
 *          else {
 *              // cwd is a workspace or subdir of one...
 *          }
 *      }
 *
 * In some cases, a directory can correspond to an App and a Workspace.
 */
class Context {
    constructor (config) {
        this.data = null;

        Object.assign(this, config);

        if (this.creator && this.creator.isManager) {
            this._manager = this.creator;
            this.creator = null;
        }

        this.dir = this.dir.absolutify();
        this.file = this.file.absolutify();
    }

    /**
     * @property {"app.json"/"package.json"/"workspace.json"} FILE
     */
    static get FILE () {
        return this.$file || (this.$file = this.KEY + '.json');
    }

    /**
     * @property {"app"/"package"/"workspace"} KEY
     */
    static get KEY () {
        return this.$key || (this.$key = this.name.toLowerCase());
    }

    /**
     * Returns `true` if the given directory is this type of `Context`.
     * @param {String/phylo.File} dir
     * @return {Boolean}
     */
    static at (dir) {
        let d = Phyl.from(dir);

        if (this === Context) {
            return App.at(d) || Package.at(d) || Workspace.at(d);
        }

        return d.hasFile(this.FILE);
    }

    /**
     * Starting in the specified location and climbing upwards, create and return the
     * most specific type of `Context`.
     * @param {String/File} dir The path as a string of `File` (from `phylo` module).
     * @param {Context/Manager} [creator] Used internally to pass the Context responsible
     * for creating this new Context. If there is no owning Context, alternatively this
     * may be a Manager instance.
     * @return {Context} The most specific type of context or `null`.
     */
    static from (dir, creator = null) {
        let root = Phyl.from(dir).up(d => this.at(d));

        return this.load(root, creator);
    }

    /**
     * Starting in the `cwd()` and climbing upwards, create and return the most specific
     * type of `Context`.
     * @param {Context} [creator] Used internally to pass the Context responsible for
     * creating this new Context.
     * @return {Context} The most specific type of context or `null`.
     */
    static get (creator = null) {
        return Context.from(Phyl.cwd(), creator);
    }

    /**
     * From the specified location, create and return the most specific type of `Context`.
     * @param {String/File} dir The path as a string of `File` (from `phylo` module).
     * @param {Context} [creator] Used internally to pass the Context responsible for
     * creating this new Context.
     * @return {Context} The most specific type of context or `null`.
     */
    static load (dir, creator = null) {
        if (dir == null) {
            return null;
        }

        let d = Phyl.from(dir);

        if (this === Context) {
            return App.load(d, creator) || Package.load(d, creator) || Workspace.load(d, creator);
        }

        if (!this.at(d)) {
            return null;
        }

        let file = d.join(this.FILE);
        let data = file.load();
        let config = {
            dir: file.parent,
            file,
            data
        };

        if (creator) {
            config.creator = creator;
        }

        return new this(config);
    }

    get manager () {
        return this._manager || this.workspace.manager;
    }

    // set manager (value) {
    //     if (value && !value.baseDir) {
    //         value.baseDir = this.workspace.dir;
    //     }
    //
    //     this._manager = value;
    // }

    /**
     * @property {Workspace} workspace
     * The owning workspace for this context.
     */

    /**
     * Returns the `PropertyMap` of properties for this context.
     * @param {Boolean} [refresh] Pass `true` to rebuild the property map.
     * @return {PropertyMap}
     */
    getConfigProps (refresh = false) {
        if (refresh) {
            this.configProps = null;
        }

        return this.configProps || (this.configProps = this._gatherProps());
    }

    /**
     * Looks up a property in the property map (see `getConfigProps`).
     * @param {String} prop The name of the property to retrieve.
     * @param {Boolean} [refresh] Pass `true` to rebuild the property map.
     * @return {String/Number/Boolean}
     */
    getProp (prop, refresh = false) {
        let props = this.getConfigProps(refresh);
        return props.get(prop);
    }

    /**
     * Returns the relative path (from this context's `dir`) to a given `path`. This
     * path will always use `/` separators even on Windows.
     * @param {File/String} path The path to a file or directory to be made relative
     * @param {'this'/'workspace'} [base='this'] Pass 'workspace' to use the workspace
     * root folder as the base.
     * @returns {File}
     */
    relativize (path, base = 'this') {
        base = (base === 'workspace') ? this.workspace.dir : this.dir;

        let rel = Phyl.from(path).relativize(base);
        rel = rel.slashify();
        return rel;
    }

    /**
     * Populates and returns a `PropertyMap` with all the config properties for this
     * context.
     * @param {PropertyMap} propMap
     * @returns {PropertyMap}
     * @protected
     */
    _gatherProps (propMap = null) {
        propMap = propMap || new PropertyMap();

        let key = this.constructor.KEY;

        propMap.flatten(key, this.data);
        propMap.add(key + '.dir', this.dir.path);

        return propMap;
    }

    /**
     * Defines a property on this instance using `Object.defineProperty`.
     * @param {String} prop The name of the property
     * @param value The value of the property
     * @protected
     */
    _set (prop, value) {
        Object.defineProperty(this, prop, { value: value });
    }
}

Object.assign(Context.prototype, {
    isContext: true,
    configProps: null,
    creator: null
});

//--------------------------------------------------------------------------------

class Workspace extends Context {
    constructor (config) {
        super(config);

        if (this.creator && this.creator._manager) {
            this._manager = this.creator._manager;
        }

        if (this._manager && !this._manager.baseDir) {
            this._manager.baseDir = this.dir;
        }

        this.frameworks = new Empty();
    }

    /**
     * @property {App[]} apps
     * The array of `App` instances for this workspace.
     */
    get apps () {
        let apps = [];
        let creator = this.creator && this.creator.isApp && this.creator;
        let creatorPath = creator && creator.dir.path;
        let found = !creator;

        if (this.data.apps) {
            let app, dir;

            for (let path of this.data.apps) {
                dir = this.dir.join(path).absolutify();

                if (dir.equals(creatorPath)) {
                    app = creator;
                    found = true;
                }
                else {
                    app = App.load(dir, this);
                }

                if (app) {
                    apps.push(app);
                }
            }
        }

        if (!found) {
            apps.push(creator);
        }

        this._set('apps', apps);

        return apps;
    }

    /**
     * @property {Package[]} packages
     * The array of `Package` instances for this workspace.
     */
    get packages () {
        let dirs = this.getPackagePath();
        let creator = this.creator && this.creator.isPackage && this.creator;
        let creatorPath = creator && creator.dir.path;
        let pkgs = [];

        let load = d => {
            let p = d.equals(creatorPath) ? creator : Package.load(d, this);
            if (p) {
                pkgs.push(p);
            }
            return p;
        };

        for (let dir of dirs) {
            // The package path can point directly at a package...
            if (!load(dir)) {
                // ...but typically points at a folder of packages
                dir.list('d', (name, d) => load(d));
            }
        }

        this._set('packages', pkgs);

        return pkgs;
    }

    get manager () {
        if (!this._manager) {
            this._manager = new Manager(this.dir);
        }

        return this._manager;
    }

    get workspace () {
        return this;
    }

    getFramework (name) {
        let fw = this.frameworks[name];

        if (!fw) {
            fw = this.data.frameworks[name];

            if (!fw) {
                raise(`No framework "${name}" found in workspace`);
            }
            if (!fw.path) {
                raise(`Framework "${name}" has no "path"`);
            }

            let dir = this.dir.resolve(fw.path);

            if (!dir.exists()) {
                raise(`Framework "${name}" path does not exist:  ${dir}`);
            }

            this.frameworks[name] = fw = Framework.load(dir, this);
        }

        return fw;
    }

    getPackagePath () {
        let dirs = [ Phyl.from(this.getProp('workspace.packages.extract')) ];
        let dir = this.getProp('workspace.packages.dir');

        if (dir) {
            for (let d of dir.split(',')) {
                dirs.push(Phyl.from(d));
            }
        }
        else {
            dirs.push(this.dir.join('packages'));
        }

        let map = {};
        let distinct = d => {
            let p = d && d.exists() && d.absolutePath();
            return p && !map[p] && (map[p] = d);
        };

        return dirs.filter(distinct).map(d => d.nativize());
    }
}

Object.assign(Workspace.prototype, {
    isWorkspace: true,
    prefix: 'workspace',

    pathMode: 'abs'
});

//--------------------------------------------------------------------------------

class CodeBase extends Context {
    get classpath () {
        let cp = this._classpath;

        if (!cp) {
            cp = this.getProp(`${this.prefix}.classpath`);
            this._classpath = cp = this._resolvePath(cp);
        }

        return cp;
    }

    get framework () {
        let ws = this.workspace,
            fw = this.data.framework;

        if (!ws) {
            raise(`Cannot find workspace for ${this.type} at ${this.dir}`);
        }

        return ws.getFramework(this.data.framework);
    }

    get overrides () {
        let op = this._overrides;

        if (!op) {
            op = this.getProp(`${this.prefix}.overrides`);
            this._overrides = op = this._resolvePath(op);
        }

        return op;
    }

    get type () {
        return this.constructor.name;
    }

    get workspace () {
        let workspace = this._workspace || this.creator;

        if (!workspace || !workspace.isWorkspace) {
            this._workspace = workspace = Workspace.from(this.dir, this);
        }

        return workspace;
    }

    getClassFiles () {
        return this._getFiles('classpath');
    }

    getOverrideFiles () {
        return this._getFiles('overrides');
    }

    async loadSources (sources = null) {
        if (!sources) {
            sources = new Sources(this.workspace, this.manager);
        }

        await sources.load(this);
        return sources;
    }

    _gatherProps (propMap = null) {
        let props = super._gatherProps(propMap);

        this.workspace._gatherProps(props);

        return props;
    }

    _getFiles (pathName) {
        let filesName = `_${pathName}Files`;
        let files = this[filesName];

        if (!files) {
            this[filesName] = files = [];

            let path = this[pathName];
            for (let entry of path) {
                if (entry.isFile()) {
                    files.push(entry);
                }
                else {
                    entry.walk('f', '**/*.js', f => files.push(f));
                }
            }
        }

        return files;
    }

    _resolvePath (path) {
        return path.split(',').map(p => this.dir.resolve(p));
    }
}

Object.assign(CodeBase.prototype, {
    isCodeBase: true
});

//--------------------------------------------------------------------------------

class App extends CodeBase {
}

Object.assign(App.prototype, {
    isApp: true,
    prefix: 'app'
});

//--------------------------------------------------------------------------------

class Package extends CodeBase {
    static at (dir) {
        if (super.at(dir)) {
            let data = dir.join(this.FILE).load();
            return typeof data.sencha === 'object';
        }

        return false;
    }

    constructor (config) {
        let data = config.data;
        let sencha = data && data.sencha;

        if (sencha) {
            delete data.sencha;
            sencha.$npm = data;
            sencha.name = sencha.name || data.name;
            sencha.version = sencha.version || data.version;

            config.data = sencha;
        }

        super(config);
    }
}

Object.assign(Package.prototype, {
    isPackage: true,
    prefix: 'package'
});

//--------------------------------------------------------------------------------

class Framework extends Package {
    //
}

Object.assign(Framework.prototype, {
    isFramework: true,
    prefix: 'framework'
});

//--------------------------------------------------------------------------------

module.exports = {
    Manager,
    Context,
    Workspace,
    CodeBase,
    App,
    Package,
    Framework
};
