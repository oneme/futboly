import {Property} from "./Property";

export class Dealership extends Property {
    card: string;
    constructor(dealership: any) {
        super(dealership);
        this.card = dealership.card;
    }

    rent(prop: number): number {
        let result = 0;
        if (!this.mortgaged) {
            result = this.rents[prop - 1].rent;
        }
        console.log(`rent was: ${result}`);
        return result;
    }
}