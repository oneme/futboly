import {DepartmentType} from "@/types";
export class Department {
    name : string;
    quantity : number;
    type: DepartmentType;
    path : string;
    constructor(department: any) {
        this.name = department.name;
        this.quantity = department.quantity;
        this.type = department.type;
        this.path = department.path;
    }
}