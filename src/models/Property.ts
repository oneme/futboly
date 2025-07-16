import {PropertyType} from "@/types";

export interface IRent {
    title: string;
    rent: number;
}
export class Property {
    id: number
    name: string;
    path: string;
    type: PropertyType;
    mortgage: number;
    price: number;
    rents: Array<IRent>;
    mortgaged: boolean;

    constructor(property: any) {
        this.id = property.id;
        this.name = property.name;
        this.path = property.path;
        this.type = property.type;
        this.mortgage = property.mortgage;
        this.price = property.price;
        this.rents = property.rents;
        this.mortgaged = false;
    }

    get mortgageTotal(): number {
        return this.mortgage + (this.mortgage * 0.1);
    }

    get fullName(): string {
        return `${this.name} ${[0, 1].includes(this.type) ? (this.type === PropertyType.GENERAL ? 'General' : 'Tribuna') : ''}`.trim();
    }

}