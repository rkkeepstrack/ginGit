export namespace changes {
	
	export class FileChange {
	    path: string;
	    oldPath?: string;
	    type: string;
	    additions: number;
	    deletions: number;
	    binary: boolean;
	    touchCount: number;
	    review: string;
	    composable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileChange(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.oldPath = source["oldPath"];
	        this.type = source["type"];
	        this.additions = source["additions"];
	        this.deletions = source["deletions"];
	        this.binary = source["binary"];
	        this.touchCount = source["touchCount"];
	        this.review = source["review"];
	        this.composable = source["composable"];
	    }
	}
	export class ChangeSet {
	    hashes: string[];
	    merges: string[];
	    files: FileChange[];
	    reviewable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ChangeSet(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hashes = source["hashes"];
	        this.merges = source["merges"];
	        this.files = this.convertValues(source["files"], FileChange);
	        this.reviewable = source["reviewable"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Touch {
	    commit: string;
	    type: string;
	    path: string;
	    oldPath?: string;
	    additions: number;
	    deletions: number;
	    binary: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Touch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.commit = source["commit"];
	        this.type = source["type"];
	        this.path = source["path"];
	        this.oldPath = source["oldPath"];
	        this.additions = source["additions"];
	        this.deletions = source["deletions"];
	        this.binary = source["binary"];
	    }
	}

}

export namespace diff {
	
	export class Side {
	    blob: string;
	    path: string;
	    content: string;
	    size: number;
	    missing: boolean;
	    binary: boolean;
	    tooLarge: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Side(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.blob = source["blob"];
	        this.path = source["path"];
	        this.content = source["content"];
	        this.size = source["size"];
	        this.missing = source["missing"];
	        this.binary = source["binary"];
	        this.tooLarge = source["tooLarge"];
	    }
	}
	export class Pair {
	    commit: string;
	    type: string;
	    old: Side;
	    new: Side;
	
	    static createFrom(source: any = {}) {
	        return new Pair(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.commit = source["commit"];
	        this.type = source["type"];
	        this.old = this.convertValues(source["old"], Side);
	        this.new = this.convertValues(source["new"], Side);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Result {
	    path: string;
	    type: string;
	    stacked: boolean;
	    note?: string;
	    pairs: Pair[];
	
	    static createFrom(source: any = {}) {
	        return new Result(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.type = source["type"];
	        this.stacked = source["stacked"];
	        this.note = source["note"];
	        this.pairs = this.convertValues(source["pairs"], Pair);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace repo {
	
	export class Info {
	    path: string;
	    name: string;
	    branch: string;
	    head: string;
	
	    static createFrom(source: any = {}) {
	        return new Info(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.branch = source["branch"];
	        this.head = source["head"];
	    }
	}
	export class Recent {
	    path: string;
	    name: string;
	    // Go type: time
	    lastOpen: any;
	
	    static createFrom(source: any = {}) {
	        return new Recent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.lastOpen = this.convertValues(source["lastOpen"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Ref {
	    name: string;
	    full: string;
	    hash: string;
	    kind: string;
	    isHead: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Ref(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.full = source["full"];
	        this.hash = source["hash"];
	        this.kind = source["kind"];
	        this.isHead = source["isHead"];
	    }
	}

}

