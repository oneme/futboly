import {Department} from "./Department";
import {Property} from "./Property";

export class Box {
    id: number;
    kind: Property | Department;

    constructor(id: number, kind: Property | Department) {
        this.id = id
        this.kind = kind
    }
}