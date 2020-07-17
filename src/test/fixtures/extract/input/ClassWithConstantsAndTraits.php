<?php

class EmptyClass
{
    use TestTrait;

    public const FIRST_NAME = 'Jean';

    public function __construct(string $lastName = 'Michel')
    {

    }
}