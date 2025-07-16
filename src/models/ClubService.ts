import {Property} from "./Property";

export class ClubService extends Property {
    card: string;
    constructor(clubservice: any) {
        super(clubservice);
        this.card = clubservice.card;
    }

    rent(prop: number, dices: number): number {
        let result = 0;
        if (!this.mortgaged) {
            result = this.rents[prop - 1].rent * dices;
        }
        console.log(`rent was: ${result}`);
        return result;
    }
}